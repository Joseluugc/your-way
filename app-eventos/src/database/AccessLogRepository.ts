// app-eventos/src/database/AccessLogRepository.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createAccessLog,
  type AccessLogDependencies,
  type NewAccessLog,
} from '../domain/b2b/accessLog.ts';
import type { AccessAction, UUID } from '../domain/map/mapTypes';

/**
 * Guarda en SQLite las entradas y salidas del control de puertas.
 * Requiere la columna access_logs.sync_status (TASK-15).
 */
export class AccessLogRepository {
  private readonly database: SQLiteDatabase;
  private readonly dependencies: AccessLogDependencies;

  constructor(database: SQLiteDatabase, dependencies: AccessLogDependencies = {}) {
    this.database = database;
    this.dependencies = dependencies;
  }

  registerEntry(userId: UUID, zoneId: UUID): Promise<NewAccessLog> {
    return this.register(userId, zoneId, 'ENTRY');
  }

  registerExit(userId: UUID, zoneId: UUID): Promise<NewAccessLog> {
    return this.register(userId, zoneId, 'EXIT');
  }

  private async register(userId: UUID, zoneId: UUID, action: AccessAction): Promise<NewAccessLog> {
    const log = createAccessLog({ userId, zoneId, action }, this.dependencies);
    await this.database.runAsync(
      `INSERT INTO access_logs (id, user_id, zone_id, action, timestamp, sync_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      log.id,
      log.user_id,
      log.zone_id,
      log.action,
      log.timestamp,
      log.sync_status,
    );
    return log;
  }
}