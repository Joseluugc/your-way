import type { SQLiteDatabase } from 'expo-sqlite';
import {
  applyRemoteEventos,
  getEventosCursor,
  getPendingEventos,
  markEventoSynced,
  setEventosCursor,
  type RemoteEvento,
} from '../database/eventQueries';
import { ensureSession, supabase } from '../lib/supabase';

const PAGE_SIZE = 1000;
const REMOTE_COLUMNS = 'id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion, updated_at, deleted_at';

let running: Promise<void> | null = null;
let rerun = false;

/**
 * Sincroniza `eventos` con Supabase: sesión, subida de pendientes y bajada incremental.
 * Solo hay una ejecución a la vez; si se pide otra mientras corre, se repite al terminar.
 * Sin sesión se omite sin error. Si falla, las filas locales siguen `pending` y el error se propaga.
 */
export function syncEventos(db: SQLiteDatabase): Promise<void> {
  if (running) {
    rerun = true;
    return running;
  }

  running = (async () => {
    try {
      do {
        rerun = false;
        // Sin sesión (Spec 08) no se sube ni se baja nada: las filas siguen `pending`.
        if (!(await ensureSession())) return;
        await uploadPending(db);
        await downloadChanges(db);
      } while (rerun);
    } finally {
      running = null;
    }
  })();

  return running;
}

async function uploadPending(db: SQLiteDatabase): Promise<void> {
  const pending = await getPendingEventos(db);
  if (pending.length === 0) return;

  // `updated_at` lo asigna el trigger del servidor; `sync_status` es solo local.
  const rows = pending.map(({ id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion, deleted_at }) => ({
    id,
    titulo,
    fecha_inicio,
    fecha_fin,
    ubicacion,
    descripcion,
    deleted_at,
  }));

  const { error } = await supabase.from('eventos').upsert(rows, { onConflict: 'id' });
  if (error) throw error;

  for (const evento of pending) {
    await markEventoSynced(db, evento.id, evento.updated_at);
  }
}

async function downloadChanges(db: SQLiteDatabase): Promise<void> {
  let cursor = await getEventosCursor(db);

  for (;;) {
    let query = supabase
      .from('eventos')
      .select(REMOTE_COLUMNS)
      .order('updated_at', { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor) query = query.gt('updated_at', cursor);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as RemoteEvento[];
    if (rows.length === 0) return;

    await applyRemoteEventos(db, rows);
    cursor = rows[rows.length - 1].updated_at;
    await setEventosCursor(db, cursor);

    if (rows.length < PAGE_SIZE) return;
  }
}
