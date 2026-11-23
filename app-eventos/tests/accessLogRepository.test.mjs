import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { AccessLogRepository } from '../src/database/AccessLogRepository.ts';
import { createAccessLog } from '../src/domain/b2b/accessLog.ts';

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