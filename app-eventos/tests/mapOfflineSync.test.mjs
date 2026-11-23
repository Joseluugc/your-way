import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MapRepository } from '../src/database/MapRepository.ts';
import { initializeAppDatabase } from '../src/database/initializeDatabase.ts';
import {
  MAP_MOCK_ACCESS_LOGS,
  MAP_MOCK_STANDS,
  MAP_MOCK_ZONES,
} from '../src/domain/map/mapMockData.ts';
import { syncMapAndOccupancy } from '../src/domain/map/syncMapAndOccupancy.ts';
import { openDatabase } from './sqliteHarness.mjs';

async function initializeFreshDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'your-way-map-'));
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

function cleanup(database) {
  database.sqlite.close();
  rmSync(database.path, { force: true });
  rmdirSync(database.directory);
}

test('seeds UUID map data in SQLite and reads it after reopening the database', async () => {
  const firstOpen = await initializeFreshDatabase();
  let reopened = null;
  let current = firstOpen;
  try {
    const firstSnapshot = await syncMapAndOccupancy(
      new MapRepository(firstOpen.database),
      { fetchSnapshot: async () => assert.fail('offline reads must not request remote data') },
      false,
    );
    assert.equal(firstSnapshot.source, 'local');
    assert.equal(firstSnapshot.is_real_time, false);
    assert.equal(firstSnapshot.snapshot.last_synced_at, null);
    assert.equal(firstSnapshot.snapshot.stands.length, MAP_MOCK_STANDS.length);
    assert.equal(firstSnapshot.snapshot.zones.length, MAP_MOCK_ZONES.length);
    assert.equal(
      (await firstOpen.database.getFirstAsync('SELECT COUNT(*) AS count FROM access_logs')).count,
      MAP_MOCK_ACCESS_LOGS.length,
    );
    firstOpen.sqlite.close();
    reopened = openDatabase(firstOpen.path);
    current = reopened;
    const persistedSnapshot = await syncMapAndOccupancy(
      new MapRepository(reopened.database),
      { fetchSnapshot: async () => assert.fail('offline reads must not request remote data') },
      false,
    );
    assert.equal(persistedSnapshot.snapshot.stands.length, MAP_MOCK_STANDS.length);
    assert.equal(
      persistedSnapshot.snapshot.stands.find((stand) => stand.id === MAP_MOCK_STANDS[0].id).map_x,
      MAP_MOCK_STANDS[0].map_x,
    );
    assert.equal(persistedSnapshot.snapshot.zones.length, MAP_MOCK_ZONES.length);
    assert.equal(
      persistedSnapshot.snapshot.zones.find((item) => item.zone.id === MAP_MOCK_ZONES[0].id).current_capacity,
      MAP_MOCK_ZONES[0].current_capacity,
    );
    assert.equal(
      (await reopened.database.getFirstAsync('SELECT COUNT(*) AS count FROM access_logs')).count,
      MAP_MOCK_ACCESS_LOGS.length,
    );
  } finally {
    current.sqlite.close();
    rmSync(firstOpen.path, { force: true });
    rmdirSync(firstOpen.directory);
  }
});

test('offline use case returns cached occupancy and last successful sync time', async () => {
  const opened = await initializeFreshDatabase();
  try {
    const repository = new MapRepository(opened.database);
    const lastSyncedAt = '2026-11-19T14:30:00.000Z';
    await repository.recordSuccessfulSync(lastSyncedAt);

    const result = await syncMapAndOccupancy(
      repository,
      { fetchSnapshot: async () => assert.fail('offline sync must not call the remote source') },
      false,
    );
    assert.equal(result.snapshot.last_synced_at, lastSyncedAt);
    assert.equal(result.is_real_time, false);
    assert.equal(result.source, 'local');
    assert.equal(
      result.snapshot.zones.find((item) => item.zone.id === MAP_MOCK_ZONES[0].id).current_capacity,
      69,
    );
  } finally {
    cleanup(opened);
  }
});

test('failed remote sync leaves cached data and its last sync time intact', async () => {
  const opened = await initializeFreshDatabase();
  try {
    const repository = new MapRepository(opened.database);
    const lastSyncedAt = '2026-11-19T13:00:00.000Z';
    await repository.recordSuccessfulSync(lastSyncedAt);
    const before = await syncMapAndOccupancy(
      repository,
      { fetchSnapshot: async () => assert.fail('cached snapshot load should be local') },
      false,
    );

    await assert.rejects(
      syncMapAndOccupancy(
        repository,
        { fetchSnapshot: async () => { throw new Error('servidor no disponible'); } },
        true,
        '2026-11-20T13:00:00.000Z',
      ),
      /servidor no disponible/,
    );

    const after = await syncMapAndOccupancy(
      repository,
      { fetchSnapshot: async () => assert.fail('offline read should remain local') },
      false,
    );
    assert.equal(after.snapshot.last_synced_at, lastSyncedAt);
    assert.equal(after.snapshot.stands.length, before.snapshot.stands.length);
    assert.equal(after.snapshot.zones.length, before.snapshot.zones.length);
  } finally {
    cleanup(opened);
  }
});

test('remote sync upserts map records and persists the new timestamp without duplicating logs', async () => {
  const opened = await initializeFreshDatabase();
  try {
    const repository = new MapRepository(opened.database);
    const zone = MAP_MOCK_ZONES[0];
    const stand = MAP_MOCK_STANDS[0];
    const remoteSnapshot = {
      stands: [{ ...stand, owner_id: null, map_x: 77.5 }],
      zones: [{ ...zone, name: 'Sala actualizada', current_capacity: 70 }],
      users: [],
      access_logs: [
        {
          id: '650e8400-e29b-41d4-a716-999999999999',
          user_id: null,
          zone_id: zone.id,
          action: 'ENTRY',
          timestamp: '2026-11-20T10:00:00.000Z',
        },
      ],
    };
    const remoteDataSource = { fetchSnapshot: async () => remoteSnapshot };
    const syncedAt = '2026-11-20T10:05:00.000Z';

    const firstResult = await syncMapAndOccupancy(
      repository,
      remoteDataSource,
      true,
      syncedAt,
    );
    assert.equal(firstResult.source, 'remote');
    assert.equal(firstResult.is_real_time, false);
    assert.equal(firstResult.snapshot.last_synced_at, syncedAt);
    assert.equal(
      firstResult.snapshot.stands.find((item) => item.id === stand.id).map_x,
      77.5,
    );
    const updatedZone = firstResult.snapshot.zones.find((item) => item.zone.id === zone.id);
    assert.equal(updatedZone.zone.name, 'Sala actualizada');
    assert.equal(updatedZone.current_capacity, 70);

    await syncMapAndOccupancy(repository, remoteDataSource, true, syncedAt);
    assert.equal(
      (await opened.database.getFirstAsync(
        'SELECT COUNT(*) AS count FROM access_logs WHERE id = ?',
        '650e8400-e29b-41d4-a716-999999999999',
      )).count,
      1,
    );
    assert.equal(await repository.getLastSyncedAt(), syncedAt);
  } finally {
    cleanup(opened);
  }
});
