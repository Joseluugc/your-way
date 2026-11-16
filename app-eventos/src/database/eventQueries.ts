import type { SQLiteDatabase } from 'expo-sqlite';

export type Evento = {
  id: string;
  titulo: string;
  fecha_inicio: string; // ISO 8601 (UTC)
  fecha_fin: string; // ISO 8601 (UTC)
  ubicacion: string;
  descripcion: string | null;
};

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

export async function insertEvent(db: SQLiteDatabase, evento: Evento): Promise<void> {
  if (new Date(evento.fecha_fin) <= new Date(evento.fecha_inicio)) {
    throw new Error('La fecha de fin debe ser posterior a la de inicio.');
  }

  await db.runAsync(
    `INSERT INTO eventos (id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion)
     VALUES ($id, $titulo, $fechaInicio, $fechaFin, $ubicacion, $descripcion)`,
    {
      $id: evento.id,
      $titulo: evento.titulo,
      $fechaInicio: evento.fecha_inicio,
      $fechaFin: evento.fecha_fin,
      $ubicacion: evento.ubicacion,
      $descripcion: evento.descripcion,
    },
  );
}

/** Devuelve todos los eventos ordenados cronológicamente. */
export async function getEventos(db: SQLiteDatabase): Promise<Evento[]> {
  return db.getAllAsync<Evento>(
    `SELECT id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion
     FROM eventos
     ORDER BY fecha_inicio ASC`,
  );
}

export async function deleteEvent(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM eventos WHERE id = ?', id);
}
