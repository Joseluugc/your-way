import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeAppDatabase } from '../src/database/initializeDatabase.ts';
import { MapRepository } from '../src/database/MapRepository.ts';
import { createOrUpdateStand } from '../src/domain/map/manageStand.ts';
import { MAP_MOCK_STANDS, MAP_SEED_EVENT_IDS } from '../src/domain/map/mapMockData.ts';
import {
  ACHIEVEMENT_XP,
  BASE_XP,
  createXpTransaction,
  sumFinalXp,
} from '../src/domain/gamification/xpLedger.ts';
import { DEFAULT_ROULETTE_WEIGHTS } from '../src/domain/gamification/types.ts';
import { GamificationRepository } from '../src/database/GamificationRepository.ts';
import { registerGamificationModule } from '../src/domain/gamification/registerGamificationModule.ts';
import {
  FakeClock,
  RecordingEventBus,
  SeededRandom,
  SequentialIds,
} from './gamificationFakes.mjs';
import { createTempDatabase } from './sqliteHarness.mjs';

const EVENTO_ID = MAP_SEED_EVENT_IDS[0];
const STAND = MAP_MOCK_STANDS[0];
const USER_ID = '850e8400-e29b-41d4-a716-000000000001';

async function createRepository() {
  const temp = createTempDatabase('your-way-gamification-repo-');
  const wasDev = globalThis.__DEV__;
  globalThis.__DEV__ = false;
  try {
    await initializeAppDatabase(temp.database);
  } finally {
    globalThis.__DEV__ = wasDev;
  }
  return { ...temp, repository: new GamificationRepository(temp.database) };
}

function xp(overrides = {}) {
  return createXpTransaction({
    id: 'xp-1',
    userId: USER_ID,
    factionId: null,
    eventoId: EVENTO_ID,
    sourceType: 'STAMP',
    referenceId: 'stamp-1',
    baseXp: BASE_XP.STAMP,
    multiplier: 1,
    createdAt: '2026-11-15T10:05:00.000Z',
    ...overrides,
  });
}

function stamp(overrides = {}) {
  return {
    id: 'stamp-1',
    user_id: USER_ID,
    stand_id: STAND.id,
    evento_id: EVENTO_ID,
    scanned_at: '2026-11-15T10:05:00.000Z',
    zone_level_at_scan: 'available',
    applied_multiplier: 2,
    trivia_result: 'PENDING',
    trivia_answered_at: null,
    ...overrides,
  };
}

// --- Libro mayor de XP (T009) ---

test('createXpTransaction redondea base × multiplicador y valida sus entradas', () => {
  assert.equal(xp({ multiplier: 1.5, baseXp: 50 }).final_xp, 75);
  assert.equal(xp({ multiplier: 1.5, baseXp: 25, sourceType: 'TRIVIA' }).final_xp, 38);
  assert.equal(xp({ multiplier: 3 }).final_xp, 300);
  assert.throws(() => xp({ baseXp: 0 }), /mayor que 0/);
  assert.throws(() => xp({ baseXp: 12.5 }), /entero/);
  assert.throws(() => xp({ multiplier: 0.5 }), /mayor o igual que 1/);
  assert.throws(() => xp({ multiplier: Number.NaN }), /mayor o igual que 1/);
});

test('RATING, ACHIEVEMENT y ROULETTE nunca se multiplican', () => {
  for (const sourceType of ['RATING', 'ACHIEVEMENT', 'ROULETTE']) {
    const transaction = xp({ sourceType, baseXp: 200, multiplier: 2 });
    assert.equal(transaction.multiplier, 1);
    assert.equal(transaction.final_xp, 200);
  }
  assert.equal(xp({ sourceType: 'TRIVIA', baseXp: 50, multiplier: 2 }).final_xp, 100);
});

test('constantes de XP de data-model.md y suma del libro mayor', () => {
  assert.deepEqual({ ...BASE_XP }, { STAMP: 100, TRIVIA: 50, RATING: 25, ROULETTE_XP: 200 });
  assert.deepEqual(
    { ...ACHIEVEMENT_XP },
    { EARLY_BIRD: 150, EXPERT_CRITIC: 200, SECTOR_EXPLORER: 300, SPEEDRUNNER: 250 },
  );
  assert.equal(sumFinalXp([{ final_xp: 100 }, { final_xp: 50 }, { final_xp: 25 }]), 175);
  assert.equal(sumFinalXp([]), 0);
});

// --- Repositorio SQLite (T014) ---

test('el repositorio lee el estand con su zona y el evento', async () => {
  const { repository, cleanup } = await createRepository();
  try {
    assert.deepEqual(
      { ...(await repository.getStand(STAND.id)) },
      { id: STAND.id, name: STAND.name, evento_id: EVENTO_ID, zone_id: STAND.zone_id },
    );
    assert.equal(await repository.getStand('no-existe'), null);
    assert.equal((await repository.getEvento(EVENTO_ID)).id, EVENTO_ID);
    assert.equal(await repository.getEvento('no-existe'), null);
  } finally {
    cleanup();
  }
});

test('sellos, valoraciones y XP se guardan como pendientes y markSynced los confirma', async () => {
  const { repository, sqlite, cleanup } = await createRepository();
  try {
    await repository.withTransaction(async () => {
      await repository.insertStamp(stamp());
      await repository.insertXpTransaction(xp());
    });
    await repository.insertRating({
      id: 'rating-1',
      user_id: USER_ID,
      stand_id: STAND.id,
      stars: 4,
      created_at: '2026-11-15T10:06:00.000Z',
    });

    assert.deepEqual({ ...(await repository.getStamp(USER_ID, STAND.id)) }, stamp());
    assert.equal((await repository.listStamps(USER_ID, EVENTO_ID)).length, 1);
    assert.equal((await repository.listStamps(USER_ID, MAP_SEED_EVENT_IDS[1])).length, 0);
    assert.equal((await repository.getRating(USER_ID, STAND.id)).stars, 4);
    assert.equal((await repository.listRatings(USER_ID, EVENTO_ID)).length, 1);
    assert.equal(await repository.sumXp(USER_ID, EVENTO_ID), 100);
    assert.equal(await repository.sumXp(USER_ID, MAP_SEED_EVENT_IDS[1]), 0);

    assert.equal((await repository.listPendingStamps()).length, 1);
    assert.equal((await repository.listPendingRatings()).length, 1);
    const pendingXp = await repository.listPendingXpTransactions();
    assert.equal(pendingXp.length, 1);
    assert.equal('synced' in pendingXp[0], false);

    await repository.markSynced('xp_transactions', ['xp-1']);
    await repository.markSynced('user_stamps', ['stamp-1']);
    await repository.markSynced('stand_ratings', []);
    assert.equal((await repository.listPendingXpTransactions()).length, 0);
    assert.equal((await repository.listPendingStamps()).length, 0);
    assert.equal((await repository.listPendingRatings()).length, 1);
    assert.equal(sqlite.prepare("SELECT final_xp FROM xp_transactions WHERE id = 'xp-1'").get().final_xp, 100);

    await assert.rejects(repository.markSynced('stands', ['x']), /no sincronizable/);
  } finally {
    cleanup();
  }
});

test('insertXpTransaction ignora la misma (source_type, reference_id) sin duplicar puntos', async () => {
  const { repository, cleanup } = await createRepository();
  try {
    assert.equal(await repository.insertXpTransaction(xp({ id: 'xp-a' })), true);
    assert.equal(await repository.insertXpTransaction(xp({ id: 'xp-b' })), false);
    assert.equal(await repository.sumXp(USER_ID, EVENTO_ID), 100);
  } finally {
    cleanup();
  }
});

test('withTransaction deshace todo si la operación lanza y devuelve su resultado si no', async () => {
  const { repository, cleanup } = await createRepository();
  try {
    await assert.rejects(
      repository.withTransaction(async () => {
        await repository.insertStamp(stamp());
        throw new Error('fallo a mitad');
      }),
      /fallo a mitad/,
    );
    assert.equal(await repository.getStamp(USER_ID, STAND.id), null);

    assert.equal(await repository.withTransaction(async () => 42), 42);
  } finally {
    cleanup();
  }
});

test('getConfig usa los valores por defecto sin fila o con pesos inválidos', async () => {
  const { repository, sqlite, cleanup } = await createRepository();
  try {
    assert.deepEqual(await repository.getConfig(EVENTO_ID), {
      evento_id: EVENTO_ID,
      spin_every_n_stamps: 3,
      roulette_weights: { ...DEFAULT_ROULETTE_WEIGHTS },
    });

    sqlite.exec(`INSERT INTO gamification_config VALUES (
      '${EVENTO_ID}', 5, '{"XP_200":25,"MULTIPLIER_1_5":25,"RAFFLE_TICKET":25,"PHYSICAL_PRIZE":25}'
    )`);
    assert.deepEqual(await repository.getConfig(EVENTO_ID), {
      evento_id: EVENTO_ID,
      spin_every_n_stamps: 5,
      roulette_weights: { XP_200: 25, MULTIPLIER_1_5: 25, RAFFLE_TICKET: 25, PHYSICAL_PRIZE: 25 },
    });

    sqlite.exec(`UPDATE gamification_config
      SET roulette_weights_json = '{"XP_200":50,"MULTIPLIER_1_5":30,"RAFFLE_TICKET":20,"PHYSICAL_PRIZE":10}'`);
    assert.deepEqual((await repository.getConfig(EVENTO_ID)).roulette_weights, { ...DEFAULT_ROULETTE_WEIGHTS });
  } finally {
    cleanup();
  }
});

test('getTrivia parsea las opciones y getZoneLevel lee la caché de aforo', async () => {
  const { repository, sqlite, cleanup } = await createRepository();
  try {
    assert.equal(await repository.getTrivia(STAND.id), null);
    sqlite.exec(`INSERT INTO stand_trivia (id, stand_id, question, options_json, correct_option_index)
      VALUES ('trivia-1', '${STAND.id}', '¿Qué fabrica el estand?', '["Robots","Drones","Chips"]', 2)`);
    assert.deepEqual({ ...(await repository.getTrivia(STAND.id)) }, {
      id: 'trivia-1',
      stand_id: STAND.id,
      question: '¿Qué fabrica el estand?',
      options: ['Robots', 'Drones', 'Chips'],
      correct_option_index: 2,
      bonus_xp: 50,
    });

    assert.equal(await repository.getZoneLevel(STAND.zone_id), null);
    sqlite.exec(`INSERT INTO zone_occupancy_cache VALUES ('${STAND.zone_id}', 'available', '2026-11-15T10:00:00Z')`);
    assert.equal(await repository.getZoneLevel(STAND.zone_id), 'available');
  } finally {
    cleanup();
  }
});

// --- Stand.zone_id (T012) ---

test('editar un estand sin indicar zona conserva la que tenía', async () => {
  const { database, cleanup } = await createRepository();
  try {
    const mapRepository = new MapRepository(database);
    await createOrUpdateStand(
      'STAFF',
      { id: STAND.id, name: 'Nombre nuevo', map_x: 1, map_y: 2, evento_id: EVENTO_ID },
      mapRepository,
    );
    const [edited] = (await mapRepository.getStands(EVENTO_ID)).filter((item) => item.id === STAND.id);
    assert.equal(edited.name, 'Nombre nuevo');
    assert.equal(edited.zone_id, STAND.zone_id);

    await assert.rejects(
      createOrUpdateStand(
        'STAFF',
        { name: 'X', map_x: 1, map_y: 2, evento_id: EVENTO_ID, zone_id: 'no-uuid' },
        mapRepository,
      ),
      /zona no es válido/,
    );
  } finally {
    cleanup();
  }
});

// --- Registro del módulo y dobles de test (T003, T016) ---

test('registerGamificationModule devuelve un unregister idempotente', () => {
  const unregister = registerGamificationModule({
    bus: new RecordingEventBus(),
    repository: {},
    clock: new FakeClock(),
    random: new SeededRandom(),
    ids: new SequentialIds(),
  });
  assert.doesNotThrow(() => { unregister(); unregister(); });
});
