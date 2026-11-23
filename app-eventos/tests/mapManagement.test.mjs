import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MapRepository } from '../src/database/MapRepository.ts';
import { initializeAppDatabase } from '../src/database/initializeDatabase.ts';
import { createOrUpdateStand } from '../src/domain/map/manageStand.ts';
import {
  MAP_SEED_EVENT_IDS,
} from '../src/domain/map/mapMockData.ts';
import { syncMapAndOccupancy } from '../src/domain/map/syncMapAndOccupancy.ts';
import {
  canvasPointToMapCoordinates,
  mapCoordinatesToViewportPoint,
} from '../src/domain/map/mapCoordinates.ts';

const STAND_ID = '650e8400-e29b-41d4-a716-999999999991';

function openDatabase(path) {
  const sqlite = new DatabaseSync(path);
  return {
    sqlite,
    database: {
      execAsync: async (sql) => sqlite.exec(sql),
      getFirstAsync: async (sql, ...parameters) =>
        sqlite.prepare(sql).get(...parameters) ?? null,
      getAllAsync: async (sql, ...parameters) => sqlite.prepare(sql).all(...parameters),
      runAsync: async (sql, ...parameters) => sqlite.prepare(sql).run(...parameters),
      withTransactionAsync: async (operation) => {
        sqlite.exec('BEGIN');
        try {
          await operation();
          sqlite.exec('COMMIT');
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      },
    },
  };
}

async function createInitializedDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'your-way-stand-'));
  const path = join(directory, 'map.sqlite');
  const opened = openDatabase(path);
  const wasDev = globalThis.__DEV__;
  globalThis.__DEV__ = false;
  try {
    await initializeAppDatabase(opened.database);
  } finally {
    globalThis.__DEV__ = wasDev;
  }
  return { ...opened, path, directory };
}

function cleanup(opened) {
  opened.sqlite.close();
  rmSync(opened.path, { force: true });
  rmdirSync(opened.directory);
}

const validInput = {
  id: STAND_ID,
  name: 'Estand de prueba',
  owner_id: null,
  map_x: 42.5,
  map_y: 61,
  evento_id: MAP_SEED_EVENT_IDS[0],
};

test('rejects stand create and update unless the active role is STAFF', async () => {
  let saved = false;
  const repository = { saveStand: async () => { saved = true; } };

  await assert.rejects(
    createOrUpdateStand('ATTENDEE', validInput, repository),
    /se requiere el rol STAFF/i,
  );
  await assert.rejects(
    createOrUpdateStand('VIP', validInput, repository),
    /se requiere el rol STAFF/i,
  );
  assert.equal(saved, false);
});

test('validates stand names, positions, event IDs, and optional owner IDs', async () => {
  const repository = { saveStand: async () => {} };

  await assert.rejects(
    createOrUpdateStand('STAFF', { ...validInput, name: '  ' }, repository),
    /nombre para el estand/i,
  );
  for (const [map_x, map_y] of [[-1, 25], [25, 101], [Number.NaN, 25]]) {
    await assert.rejects(
      createOrUpdateStand('STAFF', { ...validInput, map_x, map_y }, repository),
      /posición válida/i,
    );
  }
  await assert.rejects(
    createOrUpdateStand('STAFF', { ...validInput, owner_id: 'not-a-uuid' }, repository),
    /propietario no es válido/i,
  );
});

test('maps normalized coordinates reversibly through zoom and pan', () => {
  const coordinates = { map_x: 15.5, map_y: 68.25 };
  const viewport = { width: 380, height: 310 };

  for (const [zoom, pan] of [
    [1, { x: 0, y: 0 }],
    [2.25, { x: -180, y: 125 }],
    [0.75, { x: 220, y: -90 }],
  ]) {
    const point = mapCoordinatesToViewportPoint(coordinates, pan, zoom, viewport, 800);
    const recovered = canvasPointToMapCoordinates(point, pan, zoom, viewport, 800);
    assert.ok(Math.abs(recovered.map_x - coordinates.map_x) < 1e-9);
    assert.ok(Math.abs(recovered.map_y - coordinates.map_y) < 1e-9);
  }
});

test('persists pending stands offline, isolates them by event, and uploads each UUID once', async () => {
  const firstOpen = await createInitializedDatabase();
  let reopened = null;
  let current = firstOpen;
  try {
    const repository = new MapRepository(firstOpen.database);
    const created = await createOrUpdateStand(
      'STAFF',
      { ...validInput, id: undefined },
      repository,
      () => STAND_ID,
    );
    assert.equal(created.sync_status, 'PENDING');
    assert.equal((await repository.getStands(MAP_SEED_EVENT_IDS[0])).some((item) => item.id === STAND_ID), true);
    assert.equal((await repository.getStands(MAP_SEED_EVENT_IDS[1])).some((item) => item.id === STAND_ID), false);
    assert.equal((await repository.getPendingStands()).length, 1);

    firstOpen.sqlite.close();
    reopened = openDatabase(firstOpen.path);
    current = reopened;
    const reopenedRepository = new MapRepository(reopened.database);
    const persisted = (await reopenedRepository.getPendingStands()).find((item) => item.id === STAND_ID);
    assert.ok(persisted);
    assert.equal(persisted.evento_id, MAP_SEED_EVENT_IDS[0]);

    const uploaded = [];
    const remoteDataSource = {
      upsertStands: async (stands) => { uploaded.push(...stands); },
      fetchSnapshot: async () => ({ stands: [], zones: [], access_logs: [], users: [] }),
    };
    const syncedAt = '2026-11-20T10:05:00.000Z';

    await syncMapAndOccupancy(reopenedRepository, remoteDataSource, true, syncedAt);
    await syncMapAndOccupancy(reopenedRepository, remoteDataSource, true, syncedAt);

    assert.equal(uploaded.length, 1);
    assert.equal(uploaded[0].id, STAND_ID);
    assert.equal(uploaded[0].evento_id, MAP_SEED_EVENT_IDS[0]);
    assert.equal((await reopenedRepository.getPendingStands()).length, 0);
    assert.equal(
      (await reopenedRepository.getStands(MAP_SEED_EVENT_IDS[0])).some((item) => item.id === STAND_ID),
      true,
    );
    assert.equal(await reopenedRepository.getLastSyncedAt(), syncedAt);
  } finally {
    current.sqlite.close();
    rmSync(firstOpen.path, { force: true });
    rmdirSync(firstOpen.directory);
  }
});

test('migration adds event and sync columns without discarding existing stands', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'your-way-stand-migration-'));
  const path = join(directory, 'map.sqlite');
  const opened = { ...openDatabase(path), path, directory };
  const existingEventId = '650e8400-e29b-41d4-a716-999999999992';
  const existingStandId = '650e8400-e29b-41d4-a716-999999999993';

  try {
    opened.sqlite.exec(`
      CREATE TABLE stands (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        owner_id TEXT,
        map_x REAL NOT NULL,
        map_y REAL NOT NULL
      );
      INSERT INTO stands VALUES ('${existingStandId}', 'Stand anterior', NULL, 21.5, 37.25);
      CREATE TABLE eventos (
        id TEXT PRIMARY KEY NOT NULL,
        titulo TEXT NOT NULL,
        fecha_inicio TEXT NOT NULL,
        fecha_fin TEXT NOT NULL,
        ubicacion TEXT NOT NULL,
        descripcion TEXT,
        updated_at TEXT,
        deleted_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );
      INSERT INTO eventos (
        id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion, updated_at, sync_status
      ) VALUES (
        '${existingEventId}', 'Evento existente', '2020-01-01T10:00:00Z',
        '2020-01-01T11:00:00Z', 'Sala', NULL, '2020-01-01T00:00:00Z', 'synced'
      );
      PRAGMA user_version = 2;
    `);

    const wasDev = globalThis.__DEV__;
    globalThis.__DEV__ = false;
    try {
      await initializeAppDatabase(opened.database);
    } finally {
      globalThis.__DEV__ = wasDev;
    }

    const repository = new MapRepository(opened.database);
    const migrated = await repository.getStands(existingEventId);
    assert.equal(migrated.length, 1);
    assert.equal(migrated[0].id, existingStandId);
    assert.equal(migrated[0].map_x, 21.5);
    assert.equal(migrated[0].map_y, 37.25);
    assert.equal(migrated[0].sync_status, 'SYNCED');
  } finally {
    cleanup(opened);
  }
});
