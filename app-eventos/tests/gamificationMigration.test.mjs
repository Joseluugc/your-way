import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initializeAppDatabase,
  initializeDatabase,
  runMigrations,
} from '../src/database/initializeDatabase.ts';
import { createTempDatabase } from './sqliteHarness.mjs';

const EVENTO_ID = '00000000-0000-4000-8000-000000000001';
const STAND_A = '750e8400-e29b-41d4-a716-000000000001';
const STAND_B = '750e8400-e29b-41d4-a716-000000000002';
const STAND_SIN_EVENTO = '750e8400-e29b-41d4-a716-000000000003';
const USER_1 = '850e8400-e29b-41d4-a716-000000000001';
const USER_2 = '850e8400-e29b-41d4-a716-000000000002';

const GAMIFICATION_TABLES = [
  'factions',
  'attendee_factions',
  'stand_trivia',
  'user_stamps',
  'stand_ratings',
  'xp_transactions',
  'user_achievements',
  'roulette_spins',
  'gamification_config',
  'zone_occupancy_cache',
  'flash_mission_alerts',
  'ranking_cache',
  'faction_score_cache',
];

async function runInitialize(database) {
  const wasDev = globalThis.__DEV__;
  globalThis.__DEV__ = false;
  try {
    await initializeAppDatabase(database);
  } finally {
    globalThis.__DEV__ = wasDev;
  }
}

/** BD en versión 3 (antes de la gamificación) con sellos y valoraciones antiguos. */
async function createVersion3Database() {
  const temp = createTempDatabase('your-way-gamification-migration-');
  await initializeDatabase(temp.database);
  await runMigrations(temp.database, 3);
  temp.sqlite.exec(`
    INSERT INTO users (id, name, email) VALUES
      ('${USER_1}', 'Ana', 'ana@test.com'),
      ('${USER_2}', 'Luis', 'luis@test.com');
    INSERT INTO stands (id, name, owner_id, map_x, map_y, evento_id) VALUES
      ('${STAND_A}', 'Estand A', NULL, 10, 10, '${EVENTO_ID}'),
      ('${STAND_B}', 'Estand B', NULL, 20, 20, '${EVENTO_ID}'),
      ('${STAND_SIN_EVENTO}', 'Estand huérfano', NULL, 30, 30, NULL);
    INSERT INTO stamps (id, user_id, stand_id, scanned_at) VALUES
      ('stamp-1', '${USER_1}', '${STAND_A}', '2026-11-15 10:05:00'),
      ('stamp-2', '${USER_2}', '${STAND_B}', '2026-11-15 10:10:00'),
      ('stamp-sin-evento', '${USER_1}', '${STAND_SIN_EVENTO}', '2026-11-15 10:20:00'),
      ('stamp-sin-usuario', NULL, '${STAND_A}', '2026-11-15 10:30:00');
    INSERT INTO ratings (id, user_id, stand_id, score, created_at) VALUES
      ('rating-1', '${USER_1}', '${STAND_A}', 5, '2026-11-15 10:06:00'),
      ('rating-duplicada', '${USER_1}', '${STAND_A}', 2, '2026-11-15 10:07:00'),
      ('rating-2', '${USER_2}', '${STAND_B}', 3, '2026-11-15 10:11:00'),
      ('rating-sin-nota', '${USER_2}', '${STAND_A}', NULL, '2026-11-15 10:12:00');
  `);
  assert.equal(temp.sqlite.prepare('PRAGMA user_version').get().user_version, 3);
  return temp;
}

function tableNames(sqlite) {
  return sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);
}

test('la migración nº 4 crea las tablas de gamificación y stands.zone_id', async () => {
  const temp = await createVersion3Database();
  try {
    await runInitialize(temp.database);

    assert.equal(temp.sqlite.prepare('PRAGMA user_version').get().user_version, 4);
    const tables = tableNames(temp.sqlite);
    for (const table of GAMIFICATION_TABLES) {
      assert.ok(tables.includes(table), `falta la tabla ${table}`);
    }
    const standColumns = temp.sqlite.prepare('PRAGMA table_info(stands)').all().map((c) => c.name);
    assert.ok(standColumns.includes('zone_id'));
    // Las tablas antiguas se conservan.
    assert.ok(tables.includes('stamps'));
    assert.ok(tables.includes('ratings'));
  } finally {
    temp.cleanup();
  }
});

test('copia stamps → user_stamps y ratings → stand_ratings sin generar XP', async () => {
  const temp = await createVersion3Database();
  try {
    await runInitialize(temp.database);

    const stamps = temp.sqlite
      .prepare('SELECT * FROM user_stamps ORDER BY id')
      .all()
      .map((row) => ({ ...row }));
    assert.deepEqual(stamps, [
      {
        id: 'stamp-1',
        user_id: USER_1,
        stand_id: STAND_A,
        evento_id: EVENTO_ID,
        scanned_at: '2026-11-15 10:05:00',
        zone_level_at_scan: null,
        applied_multiplier: 1,
        trivia_result: 'SKIPPED',
        trivia_answered_at: null,
        synced: 1,
      },
      {
        id: 'stamp-2',
        user_id: USER_2,
        stand_id: STAND_B,
        evento_id: EVENTO_ID,
        scanned_at: '2026-11-15 10:10:00',
        zone_level_at_scan: null,
        applied_multiplier: 1,
        trivia_result: 'SKIPPED',
        trivia_answered_at: null,
        synced: 1,
      },
    ]);

    const ratings = temp.sqlite
      .prepare('SELECT id, user_id, stand_id, stars, created_at, synced FROM stand_ratings ORDER BY id')
      .all()
      .map((row) => ({ ...row }));
    assert.deepEqual(ratings, [
      { id: 'rating-1', user_id: USER_1, stand_id: STAND_A, stars: 5, created_at: '2026-11-15 10:06:00', synced: 1 },
      { id: 'rating-2', user_id: USER_2, stand_id: STAND_B, stars: 3, created_at: '2026-11-15 10:11:00', synced: 1 },
    ]);

    assert.equal(temp.sqlite.prepare('SELECT COUNT(*) AS n FROM xp_transactions').get().n, 0);
  } finally {
    temp.cleanup();
  }
});

test('ejecutar la inicialización dos veces es idempotente', async () => {
  const temp = await createVersion3Database();
  try {
    await runInitialize(temp.database);
    await runInitialize(temp.database);

    assert.equal(temp.sqlite.prepare('PRAGMA user_version').get().user_version, 4);
    assert.equal(temp.sqlite.prepare('SELECT COUNT(*) AS n FROM user_stamps').get().n, 2);
    assert.equal(temp.sqlite.prepare('SELECT COUNT(*) AS n FROM stand_ratings').get().n, 2);
  } finally {
    temp.cleanup();
  }
});

test('una instalación nueva llega a la versión 4 con estands asignados a zonas', async () => {
  const temp = createTempDatabase('your-way-gamification-fresh-');
  try {
    await runInitialize(temp.database);

    assert.equal(temp.sqlite.prepare('PRAGMA user_version').get().user_version, 4);
    const withZone = temp.sqlite
      .prepare('SELECT COUNT(*) AS n FROM stands WHERE zone_id IS NOT NULL')
      .get().n;
    assert.ok(withZone > 0);
  } finally {
    temp.cleanup();
  }
});

test('xp_transactions es append-only: sin DELETE y solo se puede cambiar synced', async () => {
  const temp = await createVersion3Database();
  try {
    await runInitialize(temp.database);
    temp.sqlite.exec(`
      INSERT INTO xp_transactions (
        id, user_id, faction_id, evento_id, source_type, reference_id,
        base_xp, multiplier, final_xp, created_at
      ) VALUES (
        'xp-1', '${USER_1}', NULL, '${EVENTO_ID}', 'STAMP', 'stamp-1',
        100, 1.0, 100, '2026-11-15T10:05:00.000Z'
      );
    `);

    assert.throws(
      () => temp.sqlite.exec("DELETE FROM xp_transactions WHERE id = 'xp-1'"),
      /append-only/,
    );
    assert.throws(
      () => temp.sqlite.exec("UPDATE xp_transactions SET final_xp = 999 WHERE id = 'xp-1'"),
      /append-only/,
    );
    assert.throws(
      () => temp.sqlite.exec("UPDATE xp_transactions SET final_xp = 999, synced = 1 WHERE id = 'xp-1'"),
      /append-only/,
    );

    temp.sqlite.exec("UPDATE xp_transactions SET synced = 1 WHERE id = 'xp-1'");
    const row = temp.sqlite.prepare("SELECT final_xp, synced FROM xp_transactions WHERE id = 'xp-1'").get();
    assert.equal(row.final_xp, 100);
    assert.equal(row.synced, 1);
  } finally {
    temp.cleanup();
  }
});

test('las restricciones UNIQUE y CHECK del esquema rechazan datos inválidos', async () => {
  const temp = await createVersion3Database();
  try {
    await runInitialize(temp.database);

    // Sello duplicado para el mismo usuario y estand (FR-001).
    assert.throws(() => temp.sqlite.exec(`
      INSERT INTO user_stamps (
        id, user_id, stand_id, evento_id, scanned_at, applied_multiplier, trivia_result
      ) VALUES ('stamp-dup', '${USER_1}', '${STAND_A}', '${EVENTO_ID}', '2026-11-15T11:00:00Z', 1.0, 'PENDING');
    `), /UNIQUE/);
    // Estrellas fuera de rango.
    assert.throws(() => temp.sqlite.exec(`
      INSERT INTO stand_ratings (id, user_id, stand_id, stars, created_at)
      VALUES ('rating-6', '${USER_2}', '${STAND_A}', 6, '2026-11-15T11:00:00Z');
    `), /CHECK/);
    // Misma transacción de XP dos veces (UNIQUE(source_type, reference_id)).
    const insertXp = (id) => temp.sqlite.exec(`
      INSERT INTO xp_transactions (
        id, user_id, evento_id, source_type, reference_id, base_xp, multiplier, final_xp, created_at
      ) VALUES ('${id}', '${USER_1}', '${EVENTO_ID}', 'TRIVIA', 'stamp-1', 50, 1.0, 50, '2026-11-15T11:00:00Z');
    `);
    insertXp('xp-a');
    assert.throws(() => insertXp('xp-b'), /UNIQUE/);
    // Color de facción con formato inválido.
    assert.throws(() => temp.sqlite.exec(`
      INSERT INTO factions (id, evento_id, name, color_hex)
      VALUES ('f-1', '${EVENTO_ID}', 'Rojos', 'rojo');
    `), /CHECK/);
  } finally {
    temp.cleanup();
  }
});
