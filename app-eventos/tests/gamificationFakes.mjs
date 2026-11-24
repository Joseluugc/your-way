/**
 * Dobles de test del módulo de Gamificación: reloj, aleatoriedad e ids deterministas,
 * un bus que registra lo publicado y un remoto en memoria que imita a Supabase.
 */
/** Reloj controlable (`ClockPort`). */
export class FakeClock {
  constructor(start = '2026-11-15T10:00:00.000Z') {
    this.ms = typeof start === 'number' ? start : Date.parse(start);
  }

  now() {
    return new Date(this.ms);
  }

  advance(ms) {
    this.ms += ms;
    return this.now();
  }

  set(iso) {
    this.ms = Date.parse(iso);
    return this.now();
  }
}

/** Aleatoriedad reproducible (`RandomPort`): mulberry32, devuelve números en [0, 1). */
export class SeededRandom {
  constructor(seed = 1) {
    this.state = seed >>> 0;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/** UUID v4 deterministas (`IdGeneratorPort`): 00000000-0000-4000-8000-000000000001, … */
export class SequentialIds {
  constructor(prefix = '00000000') {
    this.prefix = prefix;
    this.counter = 0;
  }

  uuid() {
    this.counter += 1;
    return `${this.prefix}-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }
}

/**
 * Bus en memoria (`EventBusPort`) que registra cada `publish` en `published`.
 * Entrega síncrona a los suscriptores, en orden de suscripción.
 */
export class RecordingEventBus {
  constructor() {
    this.handlers = new Map();
    this.published = [];
  }

  publish(name, payload) {
    this.published.push({ name, payload });
    for (const handler of [...(this.handlers.get(name) ?? [])]) {
      handler(payload);
    }
  }

  subscribe(name, handler) {
    if (!this.handlers.has(name)) {
      this.handlers.set(name, new Set());
    }
    this.handlers.get(name).add(handler);
    return () => this.handlers.get(name).delete(handler);
  }

  /** Payloads publicados con ese nombre, en orden. */
  payloadsOf(name) {
    return this.published.filter((event) => event.name === name).map((event) => event.payload);
  }
}

const SPIN_STATUS_ORDER = { PENDING: 0, SPUN: 1, CONSUMED: 2, CLAIMED: 2 };

/**
 * Remoto en memoria que implementa `GamificationRemotePort` con la semántica de
 * contracts/supabase-sync.md: inserción por clave natural con `ON CONFLICT DO NOTHING`,
 * trivia solo sobre filas `PENDING` y estado de tiradas que solo avanza.
 *
 * - `connected = false` hace fallar todas las llamadas (modo avión).
 * - `failOn(method, { call })` hace fallar la n-ésima llamada (1-based) a ese método;
 *   sin `call`, falla la siguiente.
 */
export class InMemoryRemote {
  constructor({ connected = true } = {}) {
    this.connected = connected;
    this.calls = [];
    this.failures = new Map();
    this.callCounts = new Map();
    this.tables = {
      attendee_factions: new Map(),
      user_stamps: new Map(),
      stand_ratings: new Map(),
      user_achievements: new Map(),
      roulette_spins: new Map(),
      xp_transactions: new Map(),
    };
    this.downloads = {
      factions: [],
      standTrivia: [],
      configs: [],
      standRanking: [],
      factionScores: [],
    };
  }

  failOn(method, { call } = {}) {
    const count = this.callCounts.get(method) ?? 0;
    this.failures.set(method, call ?? count + 1);
    return this;
  }

  /** Datos que devuelven las descargas. */
  seed(downloads) {
    Object.assign(this.downloads, downloads);
    return this;
  }

  rows(table) {
    return [...this.tables[table].values()];
  }

  async uploadAttendeeFactions(rows) {
    this.#enter('uploadAttendeeFactions', rows);
    this.#insertIgnoringDuplicates('attendee_factions', rows, (row) => `${row.user_id}|${row.evento_id}`);
  }

  async uploadUserStamps(rows) {
    this.#enter('uploadUserStamps', rows);
    this.#insertIgnoringDuplicates('user_stamps', rows, (row) => `${row.user_id}|${row.stand_id}`);
  }

  async updateStampTrivia(rows) {
    this.#enter('updateStampTrivia', rows);
    for (const update of rows) {
      for (const stamp of this.tables.user_stamps.values()) {
        if (stamp.id === update.id && stamp.trivia_result === 'PENDING') {
          stamp.trivia_result = update.trivia_result;
          stamp.trivia_answered_at = update.trivia_answered_at;
        }
      }
    }
  }

  async uploadStandRatings(rows) {
    this.#enter('uploadStandRatings', rows);
    this.#insertIgnoringDuplicates('stand_ratings', rows, (row) => `${row.user_id}|${row.stand_id}`);
  }

  async uploadUserAchievements(rows) {
    this.#enter('uploadUserAchievements', rows);
    this.#insertIgnoringDuplicates(
      'user_achievements',
      rows,
      (row) => `${row.user_id}|${row.evento_id}|${row.code}`,
    );
  }

  async uploadRouletteSpins(rows) {
    this.#enter('uploadRouletteSpins', rows);
    this.#insertIgnoringDuplicates(
      'roulette_spins',
      rows,
      (row) => `${row.user_id}|${row.evento_id}|${row.trigger_stamp_count}`,
    );
  }

  async updateRouletteSpinStatus(rows) {
    this.#enter('updateRouletteSpinStatus', rows);
    for (const update of rows) {
      for (const spin of this.tables.roulette_spins.values()) {
        if (spin.id === update.id && SPIN_STATUS_ORDER[update.status] > SPIN_STATUS_ORDER[spin.status]) {
          Object.assign(spin, update);
        }
      }
    }
  }

  async uploadXpTransactions(rows) {
    this.#enter('uploadXpTransactions', rows);
    this.#insertIgnoringDuplicates(
      'xp_transactions',
      rows,
      (row) => `${row.source_type}|${row.reference_id}`,
    );
  }

  async downloadFactions(eventoId) {
    this.#enter('downloadFactions', eventoId);
    return this.downloads.factions.filter((row) => row.evento_id === eventoId).map((row) => ({ ...row }));
  }

  async downloadStandTrivia(eventoId) {
    this.#enter('downloadStandTrivia', eventoId);
    return this.downloads.standTrivia
      .filter((row) => row.evento_id === undefined || row.evento_id === eventoId)
      .map((row) => {
        const trivia = { ...row };
        delete trivia.evento_id;
        return trivia;
      });
  }

  async downloadConfig(eventoId) {
    this.#enter('downloadConfig', eventoId);
    const config = this.downloads.configs.find((row) => row.evento_id === eventoId);
    return config ? { ...config } : null;
  }

  async downloadStandRanking(eventoId) {
    this.#enter('downloadStandRanking', eventoId);
    return this.downloads.standRanking.filter((row) => row.evento_id === eventoId).map((row) => ({ ...row }));
  }

  async downloadFactionScores(eventoId) {
    this.#enter('downloadFactionScores', eventoId);
    return this.downloads.factionScores.filter((row) => row.evento_id === eventoId).map((row) => ({ ...row }));
  }

  #enter(method, argument) {
    const count = (this.callCounts.get(method) ?? 0) + 1;
    this.callCounts.set(method, count);
    this.calls.push({ method, argument });
    if (!this.connected) {
      throw new Error(`Sin conexión (${method})`);
    }
    if (this.failures.get(method) === count) {
      this.failures.delete(method);
      throw new Error(`Fallo simulado en ${method} (llamada ${count})`);
    }
  }

  #insertIgnoringDuplicates(table, rows, naturalKey) {
    const stored = this.tables[table];
    for (const row of rows) {
      if ('synced' in row) {
        throw new Error(`La columna local «synced» no debe subirse (${table}).`);
      }
      const key = naturalKey(row);
      const duplicateId = [...stored.values()].some((existing) => existing.id === row.id);
      if (!stored.has(key) && !duplicateId) {
        stored.set(key, { ...row });
      }
    }
  }
}
