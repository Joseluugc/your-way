import type { SQLiteDatabase } from 'expo-sqlite';
import type { AccessLog, Stand, Zone } from '../domain/map/mapTypes';
import type {
  MapSyncRepositoryPort,
  RemoteMapSnapshot,
} from '../domain/map/syncMapAndOccupancy';
import type { Evento } from './eventQueries';

interface SyncStateRow {
  last_synced_at: string;
}

export class MapRepository implements MapSyncRepositoryPort {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  getStands(eventId?: string | null): Promise<Stand[]> {
    if (!eventId) {
      return this.database.getAllAsync<Stand>(`
        SELECT id, name, owner_id, map_x, map_y, evento_id, sync_status
        FROM stands
        ORDER BY name COLLATE NOCASE
      `);
    }

    return this.database.getAllAsync<Stand>(
      `SELECT id, name, owner_id, map_x, map_y, evento_id, sync_status
       FROM stands
       WHERE evento_id = ?
       ORDER BY name COLLATE NOCASE`,
      eventId,
    );
  }

  getEvents(): Promise<Evento[]> {
    return this.database.getAllAsync<Evento>(`
      SELECT id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion,
             updated_at, deleted_at, sync_status
      FROM eventos
      WHERE deleted_at IS NULL
      ORDER BY fecha_inicio, titulo COLLATE NOCASE
    `);
  }

  getPendingStands(): Promise<Stand[]> {
    return this.database.getAllAsync<Stand>(`
      SELECT id, name, owner_id, map_x, map_y, evento_id, sync_status
      FROM stands
      WHERE sync_status = 'PENDING'
      ORDER BY name COLLATE NOCASE
    `);
  }

  async saveStand(stand: Stand): Promise<void> {
    if (stand.owner_id !== null) {
      const owner = await this.database.getFirstAsync<{ id: string }>(
        'SELECT id FROM users WHERE id = ?',
        stand.owner_id,
      );
      if (!owner) {
        throw new Error(
          'El propietario no existe en la base de datos local. Sincroniza los usuarios o deja el campo vacío.',
        );
      }
    }

    await this.database.runAsync(
      `INSERT INTO stands (
         id, name, owner_id, map_x, map_y, evento_id, sync_status
       ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         owner_id = excluded.owner_id,
         map_x = excluded.map_x,
         map_y = excluded.map_y,
         evento_id = excluded.evento_id,
         sync_status = 'PENDING'`,
      stand.id,
      stand.name,
      stand.owner_id,
      stand.map_x,
      stand.map_y,
      stand.evento_id,
    );
  }

  async markStandSynced(stand: Stand): Promise<void> {
    await this.database.runAsync(
      `UPDATE stands SET sync_status = 'SYNCED'
       WHERE id = ? AND name = ? AND owner_id IS ? AND map_x = ? AND map_y = ?
         AND evento_id = ? AND sync_status = 'PENDING'`,
      stand.id,
      stand.name,
      stand.owner_id,
      stand.map_x,
      stand.map_y,
      stand.evento_id,
    );
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

  async applyRemoteSnapshot(snapshot: RemoteMapSnapshot, syncedAt: string): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      for (const user of snapshot.users) {
        await this.database.runAsync(
          `INSERT INTO users (id, name, email, role, company, linkedin_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             email = excluded.email,
             role = excluded.role,
             company = excluded.company,
             linkedin_url = excluded.linkedin_url,
             created_at = excluded.created_at`,
          user.id,
          user.name,
          user.email,
          user.role,
          user.company,
          user.linkedin_url,
          user.created_at,
        );
      }

      for (const stand of snapshot.stands) {
        await this.database.runAsync(
          `INSERT INTO stands (
             id, name, owner_id, map_x, map_y, evento_id, sync_status
           ) VALUES (?, ?, ?, ?, ?, ?, 'SYNCED')
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             owner_id = excluded.owner_id,
             map_x = excluded.map_x,
             map_y = excluded.map_y,
             evento_id = excluded.evento_id,
             sync_status = 'SYNCED'
           WHERE stands.sync_status != 'PENDING'`,
          stand.id,
          stand.name,
          stand.owner_id,
          stand.map_x,
          stand.map_y,
          stand.evento_id,
        );
      }

      for (const zone of snapshot.zones) {
        await this.database.runAsync(
          `INSERT INTO zones (id, name, max_capacity, current_capacity, required_role)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             max_capacity = excluded.max_capacity,
             current_capacity = excluded.current_capacity,
             required_role = excluded.required_role`,
          zone.id,
          zone.name,
          zone.max_capacity,
          zone.current_capacity,
          zone.required_role,
        );
      }

      for (const accessLog of snapshot.access_logs) {
        await this.database.runAsync(
          `INSERT INTO access_logs (id, user_id, zone_id, action, timestamp)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             user_id = excluded.user_id,
             zone_id = excluded.zone_id,
             action = excluded.action,
             timestamp = excluded.timestamp`,
          accessLog.id,
          accessLog.user_id,
          accessLog.zone_id,
          accessLog.action,
          accessLog.timestamp,
        );
      }

      await this.database.runAsync(
        `INSERT INTO local_sync_state (scope, last_synced_at)
         VALUES ('map', ?)
         ON CONFLICT(scope) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
        syncedAt,
      );
    });
  }
}
