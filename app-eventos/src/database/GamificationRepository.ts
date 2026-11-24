import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  GamificationEvento,
  GamificationRepositoryPort,
  GamificationStand,
  SyncableGamificationTable,
} from '../domain/gamification/ports.ts';
import type { OccupancyLevel, StarRating } from '../domain/gamification/events.ts';
import {
  DEFAULT_ROULETTE_WEIGHTS,
  DEFAULT_SPIN_EVERY_N_STAMPS,
  ROULETTE_REWARDS,
  defaultGamificationConfig,
  type AchievementCode,
  type AttendeeFaction,
  type GamificationConfig,
  type PassportStamp,
  type RouletteReward,
  type RouletteSpin,
  type RouletteWeights,
  type SpinStatus,
  type StandRating,
  type StandTrivia,
  type TriviaResult,
  type UserAchievement,
  type UUID,
  type XpSource,
  type XpTransaction,
} from '../domain/gamification/types.ts';

/** Máximo de ids por `UPDATE … IN (…)`, por debajo del límite de variables de SQLite. */
const MARK_SYNCED_CHUNK = 500;

const SYNCABLE_TABLES: ReadonlySet<SyncableGamificationTable> = new Set<SyncableGamificationTable>([
  'attendee_factions',
  'user_stamps',
  'stand_ratings',
  'user_achievements',
  'roulette_spins',
  'xp_transactions',
]);

// Los CHECK de la migración nº 4 garantizan los dominios de las columnas de texto,
// así que las filas se tipan directamente con sus uniones literales.
interface StampRow {
  id: string;
  user_id: string;
  stand_id: string;
  evento_id: string;
  scanned_at: string;
  zone_level_at_scan: OccupancyLevel | null;
  applied_multiplier: number;
  trivia_result: TriviaResult;
  trivia_answered_at: string | null;
}

interface TriviaRow {
  id: string;
  stand_id: string;
  question: string;
  options_json: string;
  correct_option_index: number;
  bonus_xp: number;
}

interface RatingRow {
  id: string;
  user_id: string;
  stand_id: string;
  stars: StarRating;
  created_at: string;
}

interface XpRow {
  id: string;
  user_id: string;
  faction_id: string | null;
  evento_id: string;
  source_type: XpSource;
  reference_id: string;
  base_xp: number;
  multiplier: number;
  final_xp: number;
  created_at: string;
}

interface AchievementRow {
  id: string;
  user_id: string;
  evento_id: string;
  code: AchievementCode;
  unlocked_at: string;
}

interface SpinRow {
  id: string;
  user_id: string;
  evento_id: string;
  trigger_stamp_count: number;
  status: SpinStatus;
  reward_type: RouletteReward | null;
  spun_at: string | null;
  resolved_at: string | null;
}

interface ConfigRow {
  evento_id: string;
  spin_every_n_stamps: number;
  roulette_weights_json: string;
}

const STAMP_COLUMNS = `id, user_id, stand_id, evento_id, scanned_at, zone_level_at_scan,
  applied_multiplier, trivia_result, trivia_answered_at`;
const RATING_COLUMNS = 'id, user_id, stand_id, stars, created_at';
const XP_COLUMNS = `id, user_id, faction_id, evento_id, source_type, reference_id,
  base_xp, multiplier, final_xp, created_at`;
const ACHIEVEMENT_COLUMNS = 'id, user_id, evento_id, code, unlocked_at';
const SPIN_COLUMNS = `id, user_id, evento_id, trigger_stamp_count, status, reward_type,
  spun_at, resolved_at`;
const ATTENDEE_FACTION_COLUMNS = 'id, user_id, evento_id, faction_id, assigned_at';

/** Implementación SQLite (`your-way-v2.db`) del puerto de persistencia del módulo. */
export class GamificationRepository implements GamificationRepositoryPort {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
    const outcome: { done: boolean; value?: T } = { done: false };
    await this.database.withTransactionAsync(async () => {
      outcome.value = await operation();
      outcome.done = true;
    });
    if (!outcome.done) {
      throw new Error('La transacción terminó sin resultado.');
    }
    return outcome.value as T;
  }

  getStand(standId: UUID): Promise<GamificationStand | null> {
    return this.database.getFirstAsync<GamificationStand>(
      'SELECT id, name, evento_id, zone_id FROM stands WHERE id = ?',
      standId,
    );
  }

  getEvento(eventoId: UUID): Promise<GamificationEvento | null> {
    return this.database.getFirstAsync<GamificationEvento>(
      `SELECT id, titulo, fecha_inicio, fecha_fin
       FROM eventos
       WHERE id = ? AND deleted_at IS NULL`,
      eventoId,
    );
  }

  getAttendeeFaction(userId: UUID, eventoId: UUID): Promise<AttendeeFaction | null> {
    return this.database.getFirstAsync<AttendeeFaction>(
      `SELECT ${ATTENDEE_FACTION_COLUMNS}
       FROM attendee_factions
       WHERE user_id = ? AND evento_id = ?`,
      userId,
      eventoId,
    );
  }

  async getStamp(userId: UUID, standId: UUID): Promise<PassportStamp | null> {
    const row = await this.database.getFirstAsync<StampRow>(
      `SELECT ${STAMP_COLUMNS} FROM user_stamps WHERE user_id = ? AND stand_id = ?`,
      userId,
      standId,
    );
    return row ? toStamp(row) : null;
  }

  async listStamps(userId: UUID, eventoId: UUID): Promise<PassportStamp[]> {
    const rows = await this.database.getAllAsync<StampRow>(
      `SELECT ${STAMP_COLUMNS}
       FROM user_stamps
       WHERE user_id = ? AND evento_id = ?
       ORDER BY scanned_at, id`,
      userId,
      eventoId,
    );
    return rows.map(toStamp);
  }

  async insertStamp(stamp: PassportStamp): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO user_stamps (
         id, user_id, stand_id, evento_id, scanned_at, zone_level_at_scan,
         applied_multiplier, trivia_result, trivia_answered_at, synced
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      stamp.id,
      stamp.user_id,
      stamp.stand_id,
      stamp.evento_id,
      stamp.scanned_at,
      stamp.zone_level_at_scan,
      stamp.applied_multiplier,
      stamp.trivia_result,
      stamp.trivia_answered_at,
    );
  }

  async getTrivia(standId: UUID): Promise<StandTrivia | null> {
    const row = await this.database.getFirstAsync<TriviaRow>(
      `SELECT id, stand_id, question, options_json, correct_option_index, bonus_xp
       FROM stand_trivia
       WHERE stand_id = ?`,
      standId,
    );
    return row ? toTrivia(row) : null;
  }

  getRating(userId: UUID, standId: UUID): Promise<StandRating | null> {
    return this.database.getFirstAsync<RatingRow>(
      `SELECT ${RATING_COLUMNS} FROM stand_ratings WHERE user_id = ? AND stand_id = ?`,
      userId,
      standId,
    );
  }

  async insertRating(rating: StandRating): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO stand_ratings (id, user_id, stand_id, stars, created_at, synced)
       VALUES (?, ?, ?, ?, ?, 0)`,
      rating.id,
      rating.user_id,
      rating.stand_id,
      rating.stars,
      rating.created_at,
    );
  }

  listRatings(userId: UUID, eventoId: UUID): Promise<StandRating[]> {
    return this.database.getAllAsync<RatingRow>(
      `SELECT rating.id, rating.user_id, rating.stand_id, rating.stars, rating.created_at
       FROM stand_ratings AS rating
       JOIN stands AS stand ON stand.id = rating.stand_id
       WHERE rating.user_id = ? AND stand.evento_id = ?
       ORDER BY rating.created_at, rating.id`,
      userId,
      eventoId,
    );
  }

  async insertXpTransaction(transaction: XpTransaction): Promise<boolean> {
    const result = await this.database.runAsync(
      `INSERT OR IGNORE INTO xp_transactions (
         id, user_id, faction_id, evento_id, source_type, reference_id,
         base_xp, multiplier, final_xp, created_at, synced
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      transaction.id,
      transaction.user_id,
      transaction.faction_id,
      transaction.evento_id,
      transaction.source_type,
      transaction.reference_id,
      transaction.base_xp,
      transaction.multiplier,
      transaction.final_xp,
      transaction.created_at,
    );
    return result.changes > 0;
  }

  async sumXp(userId: UUID, eventoId: UUID): Promise<number> {
    const row = await this.database.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(final_xp), 0) AS total
       FROM xp_transactions
       WHERE user_id = ? AND evento_id = ?`,
      userId,
      eventoId,
    );
    return row?.total ?? 0;
  }

  async getConfig(eventoId: UUID): Promise<GamificationConfig> {
    const row = await this.database.getFirstAsync<ConfigRow>(
      `SELECT evento_id, spin_every_n_stamps, roulette_weights_json
       FROM gamification_config
       WHERE evento_id = ?`,
      eventoId,
    );
    if (!row) {
      return defaultGamificationConfig(eventoId);
    }
    return {
      evento_id: row.evento_id,
      spin_every_n_stamps:
        Number.isInteger(row.spin_every_n_stamps) && row.spin_every_n_stamps >= 1
          ? row.spin_every_n_stamps
          : DEFAULT_SPIN_EVERY_N_STAMPS,
      roulette_weights: parseRouletteWeights(row.roulette_weights_json),
    };
  }

  async getZoneLevel(zoneId: UUID): Promise<OccupancyLevel | null> {
    const row = await this.database.getFirstAsync<{ level: OccupancyLevel }>(
      'SELECT level FROM zone_occupancy_cache WHERE zone_id = ?',
      zoneId,
    );
    return row?.level ?? null;
  }

  listPendingAttendeeFactions(): Promise<AttendeeFaction[]> {
    return this.database.getAllAsync<AttendeeFaction>(
      `SELECT ${ATTENDEE_FACTION_COLUMNS} FROM attendee_factions
       WHERE synced = 0 ORDER BY assigned_at, id`,
    );
  }

  async listPendingStamps(): Promise<PassportStamp[]> {
    const rows = await this.database.getAllAsync<StampRow>(
      `SELECT ${STAMP_COLUMNS} FROM user_stamps WHERE synced = 0 ORDER BY scanned_at, id`,
    );
    return rows.map(toStamp);
  }

  listPendingRatings(): Promise<StandRating[]> {
    return this.database.getAllAsync<RatingRow>(
      `SELECT ${RATING_COLUMNS} FROM stand_ratings WHERE synced = 0 ORDER BY created_at, id`,
    );
  }

  listPendingAchievements(): Promise<UserAchievement[]> {
    return this.database.getAllAsync<AchievementRow>(
      `SELECT ${ACHIEVEMENT_COLUMNS} FROM user_achievements
       WHERE synced = 0 ORDER BY unlocked_at, id`,
    );
  }

  listPendingSpins(): Promise<RouletteSpin[]> {
    return this.database.getAllAsync<SpinRow>(
      `SELECT ${SPIN_COLUMNS} FROM roulette_spins
       WHERE synced = 0 ORDER BY trigger_stamp_count, id`,
    );
  }

  listPendingXpTransactions(): Promise<XpTransaction[]> {
    return this.database.getAllAsync<XpRow>(
      `SELECT ${XP_COLUMNS} FROM xp_transactions WHERE synced = 0 ORDER BY created_at, id`,
    );
  }

  async markSynced(table: SyncableGamificationTable, ids: readonly UUID[]): Promise<void> {
    // El nombre de tabla se interpola: solo se aceptan las de la lista blanca.
    if (!SYNCABLE_TABLES.has(table)) {
      throw new Error(`Tabla no sincronizable: ${String(table)}`);
    }
    for (let offset = 0; offset < ids.length; offset += MARK_SYNCED_CHUNK) {
      const chunk = ids.slice(offset, offset + MARK_SYNCED_CHUNK);
      const placeholders = chunk.map(() => '?').join(', ');
      await this.database.runAsync(
        `UPDATE ${table} SET synced = 1 WHERE synced = 0 AND id IN (${placeholders})`,
        ...chunk,
      );
    }
  }
}

function toStamp(row: StampRow): PassportStamp {
  return {
    id: row.id,
    user_id: row.user_id,
    stand_id: row.stand_id,
    evento_id: row.evento_id,
    scanned_at: row.scanned_at,
    zone_level_at_scan: row.zone_level_at_scan,
    applied_multiplier: row.applied_multiplier,
    trivia_result: row.trivia_result,
    trivia_answered_at: row.trivia_answered_at,
  };
}

/** Una trivia con opciones corruptas se trata como inexistente (el sello queda `SKIPPED`). */
function toTrivia(row: TriviaRow): StandTrivia | null {
  const options = parseTriviaOptions(row.options_json);
  const index = row.correct_option_index;
  if (!options || (index !== 0 && index !== 1 && index !== 2)) {
    console.warn(`La trivia del estand ${row.stand_id} tiene un formato inválido; se omite.`);
    return null;
  }
  return {
    id: row.id,
    stand_id: row.stand_id,
    question: row.question,
    options,
    correct_option_index: index,
    bonus_xp: row.bonus_xp,
  };
}

function parseTriviaOptions(json: string): [string, string, string] | null {
  const value = parseJson(json);
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every((option): option is string => typeof option === 'string' && option.trim() !== '')
  ) {
    return null;
  }
  return [value[0], value[1], value[2]];
}

/** Pesos inválidos (no enteros, negativos o que no suman 100) → valores por defecto. */
function parseRouletteWeights(json: string): RouletteWeights {
  const value = parseJson(json);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ...DEFAULT_ROULETTE_WEIGHTS };
  }
  const record = value as Record<string, unknown>;
  const weights = { ...DEFAULT_ROULETTE_WEIGHTS };
  let total = 0;
  for (const reward of ROULETTE_REWARDS) {
    const weight = record[reward];
    if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 0) {
      return { ...DEFAULT_ROULETTE_WEIGHTS };
    }
    weights[reward] = weight;
    total += weight;
  }
  return total === 100 ? weights : { ...DEFAULT_ROULETTE_WEIGHTS };
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
