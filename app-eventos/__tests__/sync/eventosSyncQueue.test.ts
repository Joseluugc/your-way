import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  applyRemoteEventos,
  deleteEvent,
  getEventos,
  getPendingEventos,
  insertEvent,
  type NuevoEvento,
} from '../../src/database/eventQueries';
import { initializeDatabase, runMigrations } from '../../src/database/initializeDatabase';
import { syncEventos } from '../../src/sync/eventosSync';
import { mockEventosRemote } from '../helpers/fakeSupabase';
import { createTempDatabase, plain } from '../helpers/sqliteHarness';

// Sin Supabase ni red real: la cola se prueba contra un doble en memoria.
jest.mock('../../src/lib/supabase', () => require('../helpers/fakeSupabase').fakeSupabaseModule);

const EVENTO: NuevoEvento = {
  id: 'e0000000-0000-4000-8000-000000000001',
  titulo: 'Charla offline',
  fecha_inicio: '2026-11-20T10:00:00.000Z',
  fecha_fin: '2026-11-20T11:00:00.000Z',
  ubicacion: 'Sala 1',
  descripcion: null,
};

describe('[US-07.1] [US-07.2] [US-07.3] cola de sincronización offline → online', () => {
  let temp: ReturnType<typeof createTempDatabase>;

  beforeEach(async () => {
    mockEventosRemote.reset();
    temp = createTempDatabase();
    await initializeDatabase(temp.database);
    await runMigrations(temp.database);
    // Partimos de una base sin los eventos de ejemplo de las migraciones.
    temp.sqlite.exec('DELETE FROM stands; DELETE FROM eventos;');
  });

  afterEach(() => {

    temp.cleanup();

  });

  const localRow = (id: string) =>
    plain(
      temp.sqlite.prepare('SELECT id, titulo, sync_status, deleted_at FROM eventos WHERE id = ?').all(id),
    )[0] as { id: string; titulo: string; sync_status: string; deleted_at: string | null } | undefined;

  it('[US-07.3] un evento creado sin red queda pending', async () => {
    mockEventosRemote.online = false;
    await insertEvent(temp.database, EVENTO);

    await expect(syncEventos(temp.database)).rejects.toThrow('Network request failed');

    expect(localRow(EVENTO.id)?.sync_status).toBe('pending');
    expect((await getPendingEventos(temp.database)).map((row) => row.id)).toEqual([EVENTO.id]);
    expect(mockEventosRemote.rows.size).toBe(0);
  });

  it('[US-07.1] tras una subida correcta el evento pasa a synced', async () => {
    await insertEvent(temp.database, EVENTO);

    await syncEventos(temp.database);

    expect(localRow(EVENTO.id)?.sync_status).toBe('synced');
    expect(mockEventosRemote.rows.get(EVENTO.id)).toMatchObject({ id: EVENTO.id, titulo: EVENTO.titulo });
    expect(await getPendingEventos(temp.database)).toEqual([]);
  });

  it('[US-07.1] la subida no envía updated_at ni sync_status (los fija el servidor / son locales)', async () => {
    await insertEvent(temp.database, EVENTO);
    await syncEventos(temp.database);

    const [uploaded] = mockEventosRemote.upserts[0];
    expect(uploaded).not.toHaveProperty('updated_at');
    expect(uploaded).not.toHaveProperty('sync_status');
  });

  it('[US-07.3] un fallo de red durante la subida deja el evento pending', async () => {
    await insertEvent(temp.database, EVENTO);
    mockEventosRemote.failNextUpsert();

    await expect(syncEventos(temp.database)).rejects.toThrow('Network request failed');

    expect(localRow(EVENTO.id)?.sync_status).toBe('pending');
    expect(mockEventosRemote.rows.size).toBe(0);
  });

  it('[US-07.1] al volver la red se sube lo que quedó pendiente', async () => {
    mockEventosRemote.online = false;
    await insertEvent(temp.database, EVENTO);
    await expect(syncEventos(temp.database)).rejects.toThrow();

    mockEventosRemote.online = true;
    await syncEventos(temp.database);

    expect(localRow(EVENTO.id)?.sync_status).toBe('synced');
    expect(mockEventosRemote.rows.has(EVENTO.id)).toBe(true);
  });

  it('[US-07.2] una fila remota no sobrescribe una local pending', async () => {
    await insertEvent(temp.database, EVENTO);

    await applyRemoteEventos(temp.database, [
      { ...EVENTO, titulo: 'Versión de otro dispositivo', updated_at: '2026-11-20T12:00:00.000Z', deleted_at: null },
    ]);

    expect(localRow(EVENTO.id)).toMatchObject({ titulo: EVENTO.titulo, sync_status: 'pending' });
  });

  it('[US-07.2] al sincronizar gana la versión local pendiente y llega al servidor', async () => {
    mockEventosRemote.writeFromOtherDevice({ ...EVENTO, titulo: 'Versión de otro dispositivo', deleted_at: null });
    await insertEvent(temp.database, EVENTO);

    await syncEventos(temp.database);

    expect(localRow(EVENTO.id)).toMatchObject({ titulo: EVENTO.titulo, sync_status: 'synced' });
    expect(mockEventosRemote.rows.get(EVENTO.id)?.titulo).toBe(EVENTO.titulo);
  });

  it('[US-07.1] repetir la sincronización no duplica filas', async () => {
    await insertEvent(temp.database, EVENTO);

    await syncEventos(temp.database);
    await syncEventos(temp.database);
    await syncEventos(temp.database);

    expect(mockEventosRemote.rows.size).toBe(1);
    const localCount = temp.sqlite.prepare('SELECT COUNT(*) AS n FROM eventos').get() as { n: number };
    expect(localCount.n).toBe(1);
    expect(mockEventosRemote.upserts).toHaveLength(1);
  });

  it('[US-07.1] dos peticiones simultáneas no suben el evento dos veces', async () => {
    await insertEvent(temp.database, EVENTO);

    await Promise.all([syncEventos(temp.database), syncEventos(temp.database)]);

    expect(mockEventosRemote.rows.size).toBe(1);
    expect(mockEventosRemote.upserts).toHaveLength(1);
  });

  it('[US-07.2] baja los eventos nuevos y los borrados de otros dispositivos', async () => {
    const otro = { ...EVENTO, id: 'e0000000-0000-4000-8000-000000000002', titulo: 'Remoto' };
    mockEventosRemote.writeFromOtherDevice({ ...otro, deleted_at: null });

    await syncEventos(temp.database);
    expect((await getEventos(temp.database)).map((row) => row.titulo)).toEqual(['Remoto']);
    expect(localRow(otro.id)?.sync_status).toBe('synced');

    mockEventosRemote.writeFromOtherDevice({ ...otro, deleted_at: '2026-11-20T13:00:00.000Z' });
    await syncEventos(temp.database);
    expect(await getEventos(temp.database)).toEqual([]);
  });

  it('[US-07.1] un borrado local se sube como borrado lógico', async () => {
    await insertEvent(temp.database, EVENTO);
    await syncEventos(temp.database);

    await deleteEvent(temp.database, EVENTO.id);
    expect(localRow(EVENTO.id)?.sync_status).toBe('pending');
    await syncEventos(temp.database);

    expect(mockEventosRemote.rows.get(EVENTO.id)?.deleted_at).not.toBeNull();
    expect(localRow(EVENTO.id)?.sync_status).toBe('synced');
  });
});
