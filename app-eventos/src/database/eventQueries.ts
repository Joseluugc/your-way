import type { SQLiteDatabase } from 'expo-sqlite';
import { shouldApplyRemote } from '../domain/sync/mergeRemoteEvento';

export type SyncStatus = 'pending' | 'synced';

/** Campos de negocio de un evento (lo que se crea y lo que se sube a Supabase). */
export type NuevoEvento = {
  id: string;
  titulo: string;
  fecha_inicio: string; // ISO 8601 (UTC)
  fecha_fin: string; // ISO 8601 (UTC)
  ubicacion: string;
  descripcion: string | null;
};

/** Fila tal como viene de Supabase: `updated_at` lo asigna el servidor. */
export type RemoteEvento = NuevoEvento & {
  updated_at: string;
  deleted_at: string | null;
};

export type Evento = RemoteEvento & {
  sync_status: SyncStatus;
};

const EVENTOS_SCOPE = 'eventos';

const EVENTO_COLUMNS =
  'id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion, updated_at, deleted_at, sync_status';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Genera un UUID v4 compatible con la columna `eventos.id UUID` de PostgreSQL,
 * para que los eventos creados offline puedan sincronizarse sin colisiones.
 */
export function generateEventId(): string {
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

export async function insertEvent(db: SQLiteDatabase, evento: NuevoEvento): Promise<void> {
  if (new Date(evento.fecha_fin) <= new Date(evento.fecha_inicio)) {
    throw new Error('La fecha de fin debe ser posterior a la de inicio.');
  }

  await db.runAsync(
    `INSERT INTO eventos (id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion, updated_at, sync_status)
     VALUES ($id, $titulo, $fechaInicio, $fechaFin, $ubicacion, $descripcion, $updatedAt, 'pending')`,
    {
      $id: evento.id,
      $titulo: evento.titulo,
      $fechaInicio: evento.fecha_inicio,
      $fechaFin: evento.fecha_fin,
      $ubicacion: evento.ubicacion,
      $descripcion: evento.descripcion,
      $updatedAt: nowIso(),
    },
  );
}

/** Devuelve los eventos activos (no borrados) ordenados cronológicamente. */
export async function getEventos(db: SQLiteDatabase): Promise<Evento[]> {
  return db.getAllAsync<Evento>(
    `SELECT ${EVENTO_COLUMNS}
     FROM eventos
     WHERE deleted_at IS NULL
     ORDER BY fecha_inicio ASC`,
  );
}

/** Borrado lógico: el borrado se sincroniza como un cambio más. */
export async function deleteEvent(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowIso();
  await db.runAsync(
    `UPDATE eventos SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
    now,
    now,
    id,
  );
}

/** Eventos con cambios locales sin subir, incluidos los borrados. */
export async function getPendingEventos(db: SQLiteDatabase): Promise<Evento[]> {
  return db.getAllAsync<Evento>(
    `SELECT ${EVENTO_COLUMNS} FROM eventos WHERE sync_status = 'pending' ORDER BY updated_at ASC`,
  );
}

/**
 * Marca un evento como sincronizado solo si no ha cambiado desde que se leyó
 * (mismo `updated_at`). Si cambió durante la subida, sigue pendiente.
 */
export async function markEventoSynced(
  db: SQLiteDatabase,
  id: string,
  updatedAtLeido: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE eventos SET sync_status = 'synced' WHERE id = ? AND updated_at = ?`,
    id,
    updatedAtLeido,
  );
}

/** Aplica filas bajadas de Supabase. Las filas locales pendientes no se sobrescriben. */
export async function applyRemoteEventos(db: SQLiteDatabase, rows: RemoteEvento[]): Promise<void> {
  if (rows.length === 0) return;

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const local = await db.getFirstAsync<{ sync_status: SyncStatus }>(
        'SELECT sync_status FROM eventos WHERE id = ?',
        row.id,
      );
      if (!shouldApplyRemote(local)) continue;

      await db.runAsync(
        `INSERT INTO eventos (id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion, updated_at, deleted_at, sync_status)
         VALUES ($id, $titulo, $fechaInicio, $fechaFin, $ubicacion, $descripcion, $updatedAt, $deletedAt, 'synced')
         ON CONFLICT(id) DO UPDATE SET
           titulo = excluded.titulo,
           fecha_inicio = excluded.fecha_inicio,
           fecha_fin = excluded.fecha_fin,
           ubicacion = excluded.ubicacion,
           descripcion = excluded.descripcion,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at,
           sync_status = 'synced'`,
        {
          $id: row.id,
          $titulo: row.titulo,
          $fechaInicio: row.fecha_inicio,
          $fechaFin: row.fecha_fin,
          $ubicacion: row.ubicacion,
          $descripcion: row.descripcion,
          $updatedAt: row.updated_at,
          $deletedAt: row.deleted_at,
        },
      );
    }
  });
}

/** Cursor de bajada: el `updated_at` más alto del servidor ya recibido. */
export async function getEventosCursor(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ last_synced_at: string | null }>(
    'SELECT last_synced_at FROM local_sync_state WHERE scope = ?',
    EVENTOS_SCOPE,
  );
  return row?.last_synced_at ?? null;
}

export async function setEventosCursor(db: SQLiteDatabase, value: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO local_sync_state (scope, last_synced_at)
     VALUES (?, ?)
     ON CONFLICT(scope) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
    EVENTOS_SCOPE,
    value,
  );
}
