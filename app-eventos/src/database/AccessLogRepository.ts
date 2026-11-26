// app-eventos/src/database/AccessLogRepository.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  AccessSequenceError,
  checkAccessSequence,
  createAccessLog,
  type AccessLogDependencies,
  type NewAccessLog,
  type PreviousAccessLog,
} from '../domain/b2b/accessLog.ts';
import type { AccessAction, UUID } from '../domain/map/mapTypes';

/**
 * Guarda en SQLite las entradas y salidas del control de puertas.
 * Rechaza dobles entradas y salidas sin entrada (AccessSequenceError).
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

    const previousLogs = await this.database.getAllAsync<PreviousAccessLog>(
      'SELECT id, action, timestamp FROM access_logs WHERE user_id = ? AND zone_id = ?',
      userId,
      zoneId,
    );
    const violation = checkAccessSequence(previousLogs, action);
    if (violation !== null) {
      throw new AccessSequenceError(violation);
    }

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