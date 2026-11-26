import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { AccessLogRepository } from '../src/database/AccessLogRepository.ts';
import { AccessSequenceError, checkAccessSequence, createAccessLog } from '../src/domain/b2b/accessLog.ts';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const ZONE_ID = '22222222-2222-4222-8222-222222222222';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Tabla access_logs tal y como quedará tras TASK-15 (con sync_status).
function openDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE access_logs (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      zone_id TEXT,
      action TEXT NOT NULL CHECK (action IN ('ENTRY', 'EXIT')),
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT NOT NULL
    );
  `);
  return {
    sqlite,
    database: {
      runAsync: async (sql, ...parameters) => sqlite.prepare(sql).run(...parameters),
        getAllAsync: async (sql, ...parameters) => sqlite.prepare(sql).all(...parameters),
    },
  };
}

function allLogs(sqlite) {
  return sqlite.prepare('SELECT * FROM access_logs ORDER BY timestamp, id').all();
}

test('registra una entrada con UUID v4, hora ISO 8601 y sync_status pending', async () => {
  const { sqlite, database } = openDatabase();
  const repository = new AccessLogRepository(database);

  const log = await repository.registerEntry(USER_ID, ZONE_ID);

  assert.match(log.id, UUID_V4);
  assert.match(log.timestamp, ISO_8601);
  const [row] = allLogs(sqlite);
  assert.equal(row.id, log.id);
  assert.equal(row.user_id, USER_ID);
  assert.equal(row.zone_id, ZONE_ID);
  assert.equal(row.action, 'ENTRY');
  assert.equal(row.timestamp, log.timestamp);
  assert.equal(row.sync_status, 'pending');
  sqlite.close();
});

test('registra una salida como EXIT y pendiente de sincronizar', async () => {
  const { sqlite, database } = openDatabase();
  const times = [new Date('2026-11-23T10:00:00.000Z'), new Date('2026-11-23T10:30:00.000Z')];
  const repository = new AccessLogRepository(database, { now: () => times.shift() });

  await repository.registerEntry(USER_ID, ZONE_ID);
  await repository.registerExit(USER_ID, ZONE_ID);

  const rows = allLogs(sqlite);
  assert.deepEqual(rows.map((row) => row.action), ['ENTRY', 'EXIT']);
  assert.deepEqual(rows.map((row) => row.timestamp), [
    '2026-11-23T10:00:00.000Z',
    '2026-11-23T10:30:00.000Z',
  ]);
  assert.ok(rows.every((row) => row.sync_status === 'pending'));
  assert.notEqual(rows[0].id, rows[1].id);
  sqlite.close();
});

test('no permite registros sin usuario o sin zona', () => {
  assert.throws(() => createAccessLog({ userId: '', zoneId: ZONE_ID, action: 'ENTRY' }));
  assert.throws(() => createAccessLog({ userId: USER_ID, zoneId: '  ', action: 'ENTRY' }));
});


const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ZONE_ID = '44444444-4444-4444-8444-444444444444';

function insertRaw(sqlite, id, userId, zoneId, action, timestamp) {
  sqlite
    .prepare(
      `INSERT INTO access_logs (id, user_id, zone_id, action, timestamp, sync_status)
       VALUES (?, ?, ?, ?, ?, 'synced')`,
    )
    .run(id, userId, zoneId, action, timestamp);
}

test('rechaza una segunda entrada seguida y no la guarda', async () => {
  const { sqlite, database } = openDatabase();
  const repository = new AccessLogRepository(database);

  await repository.registerEntry(USER_ID, ZONE_ID);
  await assert.rejects(
    repository.registerEntry(USER_ID, ZONE_ID),
    (error) => error instanceof AccessSequenceError && error.violation === 'ALREADY_INSIDE',
  );

  assert.equal(allLogs(sqlite).length, 1);
  sqlite.close();
});

test('rechaza una salida sin entrada previa y no la guarda', async () => {
  const { sqlite, database } = openDatabase();
  const repository = new AccessLogRepository(database);

  await assert.rejects(
    repository.registerExit(USER_ID, ZONE_ID),
    (error) => error instanceof AccessSequenceError && error.violation === 'NOT_INSIDE',
  );

  assert.equal(allLogs(sqlite).length, 0);
  sqlite.close();
});

test('permite entrar, salir y volver a entrar', async () => {
  const { sqlite, database } = openDatabase();
  const times = [
    new Date('2026-11-23T10:00:00.000Z'),
    new Date('2026-11-23T10:30:00.000Z'),
    new Date('2026-11-23T11:00:00.000Z'),
  ];
  const repository = new AccessLogRepository(database, { now: () => times.shift() });

  await repository.registerEntry(USER_ID, ZONE_ID);
  await repository.registerExit(USER_ID, ZONE_ID);
  await repository.registerEntry(USER_ID, ZONE_ID);

  assert.deepEqual(allLogs(sqlite).map((row) => row.action), ['ENTRY', 'EXIT', 'ENTRY']);
  sqlite.close();
});

test('la entrada en otra zona o de otro usuario no cuenta como doble entrada', async () => {
  const { sqlite, database } = openDatabase();
  const repository = new AccessLogRepository(database);

  await repository.registerEntry(USER_ID, ZONE_ID);
  await repository.registerEntry(USER_ID, OTHER_ZONE_ID);
  await repository.registerEntry(OTHER_USER_ID, ZONE_ID);

  assert.equal(allLogs(sqlite).length, 3);
  sqlite.close();
});

test('ordena por hora real aunque se mezclen formatos de SQLite e ISO 8601', async () => {
  const { sqlite, database } = openDatabase();
  // Salida a las 09:30 (ISO) y entrada a las 10:00 (formato SQLite): está dentro.
  insertRaw(sqlite, 'log-exit', USER_ID, ZONE_ID, 'EXIT', '2026-11-23T09:30:00.000Z');
  insertRaw(sqlite, 'log-entry', USER_ID, ZONE_ID, 'ENTRY', '2026-11-23 10:00:00');
  const repository = new AccessLogRepository(database);

  await assert.rejects(repository.registerEntry(USER_ID, ZONE_ID), AccessSequenceError);
  sqlite.close();
});

test('checkAccessSequence aplica la regla sin base de datos', () => {
  const entry = { id: 'a', action: 'ENTRY', timestamp: '2026-11-23T10:00:00.000Z' };
  const exit = { id: 'b', action: 'EXIT', timestamp: '2026-11-23T10:30:00.000Z' };

  assert.equal(checkAccessSequence([], 'ENTRY'), null);
  assert.equal(checkAccessSequence([], 'EXIT'), 'NOT_INSIDE');
  assert.equal(checkAccessSequence([entry], 'ENTRY'), 'ALREADY_INSIDE');
  assert.equal(checkAccessSequence([entry], 'EXIT'), null);
  assert.equal(checkAccessSequence([exit, entry], 'EXIT'), 'NOT_INSIDE');
  assert.equal(checkAccessSequence([entry, exit], 'ENTRY'), null);
});