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

/**
 * Regla contra dobles conteos de aforo (Spec 03, apartado Aforo):
 * - No se registra un ENTRY si lo último de ese usuario en esa zona ya es ENTRY.
 * - No se registra un EXIT si no consta una entrada previa sin salida.
 */
export type AccessSequenceViolation = 'ALREADY_INSIDE' | 'NOT_INSIDE';

const VIOLATION_MESSAGES: Record<AccessSequenceViolation, string> = {
  ALREADY_INSIDE: 'La persona ya está dentro de esta zona.',
  NOT_INSIDE: 'No consta la entrada de esta persona en esta zona.',
};

export class AccessSequenceError extends Error {
  readonly violation: AccessSequenceViolation;

  constructor(violation: AccessSequenceViolation) {
    super(VIOLATION_MESSAGES[violation]);
    this.name = 'AccessSequenceError';
    this.violation = violation;
  }
}

export interface PreviousAccessLog {
  id: UUID;
  action: AccessAction;
  timestamp: string | null;
}

// SQLite guarda CURRENT_TIMESTAMP como "YYYY-MM-DD HH:MM:SS" (UTC) y nosotros
// ISO 8601: como texto no se ordenan bien, así que se comparan instantes.
// Las horas ausentes o inválidas van al final.
function timestampValue(timestamp: string | null): number {
  if (!timestamp) {
    return Number.POSITIVE_INFINITY;
  }
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(timestamp)
    ? `${timestamp.replace(' ', 'T')}Z`
    : timestamp;
  const value = Date.parse(normalized);
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

/** Última acción registrada, ordenando por hora real (y por id si empatan). */
export function getLastAccessAction(previousLogs: readonly PreviousAccessLog[]): AccessAction | null {
  if (previousLogs.length === 0) {
    return null;
  }
  const sorted = [...previousLogs].sort((first, second) => {
    const firstTime = timestampValue(first.timestamp);
    const secondTime = timestampValue(second.timestamp);
    if (firstTime !== secondTime) {
      return firstTime < secondTime ? -1 : 1;
    }
    return first.id < second.id ? -1 : first.id > second.id ? 1 : 0;
  });
  return sorted[sorted.length - 1].action;
}

/** Devuelve el motivo por el que no se puede registrar la acción, o null si es válida. */
export function checkAccessSequence(
  previousLogs: readonly PreviousAccessLog[],
  action: AccessAction,
): AccessSequenceViolation | null {
  const lastAction = getLastAccessAction(previousLogs);
  if (action === 'ENTRY' && lastAction === 'ENTRY') {
    return 'ALREADY_INSIDE';
  }
  if (action === 'EXIT' && lastAction !== 'ENTRY') {
    return 'NOT_INSIDE';
  }
  return null;
}