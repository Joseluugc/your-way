// app-eventos/src/domain/b2b/accessLog.ts
import type { AccessAction, UUID } from '../map/mapTypes';

/**
 * Estado de sincronización de un access log. Las filas nuevas nacen
 * pendientes para que la sincronización con Supabase las suba después.
 * Si TASK-15 fija otro valor, solo hay que cambiar estas constantes.
 */
export type AccessLogSyncStatus = 'pending' | 'synced';
export const ACCESS_LOG_PENDING_STATUS: AccessLogSyncStatus = 'pending';

export interface NewAccessLog {
  id: UUID;
  user_id: UUID;
  zone_id: UUID;
  action: AccessAction;
  timestamp: string; // ISO 8601 (UTC)
  sync_status: AccessLogSyncStatus;
}

export interface AccessLogInput {
  userId: UUID;
  zoneId: UUID;
  action: AccessAction;
}

/** Permite fijar la hora y el id en los tests. */
export interface AccessLogDependencies {
  now?: () => Date;
  generateId?: () => UUID;
}

export function generateUuidV4(): UUID {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/** Construye un registro de entrada o salida listo para guardar en SQLite. */
export function createAccessLog(
  input: AccessLogInput,
  dependencies: AccessLogDependencies = {},
): NewAccessLog {
  if (input.userId.trim().length === 0) {
    throw new Error('El usuario del registro de acceso es obligatorio.');
  }
  if (input.zoneId.trim().length === 0) {
    throw new Error('La zona del registro de acceso es obligatoria.');
  }
  if (input.action !== 'ENTRY' && input.action !== 'EXIT') {
    throw new Error('La acción del registro de acceso debe ser ENTRY o EXIT.');
  }

  const now = dependencies.now ?? (() => new Date());
  const generateId = dependencies.generateId ?? generateUuidV4;

  return {
    id: generateId(),
    user_id: input.userId,
    zone_id: input.zoneId,
    action: input.action,
    timestamp: now().toISOString(),
    sync_status: ACCESS_LOG_PENDING_STATUS,
  };
}