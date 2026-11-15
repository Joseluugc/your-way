import type { SQLiteDatabase } from 'expo-sqlite';
import type { MapRepositoryPort } from '../domain/map/getMapSnapshot';
import type { AccessLog, Stand, Zone } from '../domain/map/mapTypes';

interface SyncStateRow {
  last_synced_at: string;
}

export class MapRepository implements MapRepositoryPort {
  constructor(private readonly database: SQLiteDatabase) {}

  getStands(): Promise<Stand[]> {
    return this.database.getAllAsync<Stand>(`
      SELECT id, name, owner_id, map_x, map_y
      FROM stands
      ORDER BY name COLLATE NOCASE
    `);
  }

  getZones(): Promise<Zone[]> {
    return this.database.getAllAsync<Zone>(`
      SELECT id, name, max_capacity, current_capacity, required_role
      FROM zones
      ORDER BY name COLLATE NOCASE
    `);
  }

  getAccessLogs(): Promise<AccessLog[]> {
    return this.database.getAllAsync<AccessLog>(`
      SELECT id, user_id, zone_id, action, timestamp
      FROM access_logs
      ORDER BY timestamp IS NULL, timestamp ASC, id ASC
    `);
  }

  async getLastSyncedAt(): Promise<string | null> {
    const row = await this.database.getFirstAsync<SyncStateRow>(
      'SELECT last_synced_at FROM local_sync_state WHERE scope = ?',
      'map',
    );

    return row?.last_synced_at ?? null;
  }

  async recordSuccessfulSync(timestamp = new Date().toISOString()): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO local_sync_state (scope, last_synced_at)
       VALUES ('map', ?)
       ON CONFLICT(scope) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
      timestamp,
    );
  }
}
