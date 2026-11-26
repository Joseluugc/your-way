import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SupabaseMapDataSource } from '../../src/sync/supabaseMapDataSource';
import { DEMO_STANDS, DEMO_USERS, DEMO_ZONES } from '../../src/database/demoSeedData';
import type { Stand } from '../../src/domain/map/mapTypes';

/**
 * Doble del cliente de Supabase para las tablas del plano: devuelve las filas configuradas
 * por tabla (respetando `range` e `in`) y registra las subidas.
 */
type Row = Record<string, unknown>;
const mockTables: Record<string, Row[]> = {};
const mockUpserts: { table: string; rows: Row[] }[] = [];
let mockUpsertError: { message: string } | null = null;

jest.mock('../../src/lib/supabase', () => {
  class Query {
    private from = 0;
    private to = Number.POSITIVE_INFINITY;
    private ids: string[] | null = null;
    private readonly table: string;
    constructor(tableName: string) {
      this.table = tableName;
    }
    select() {
      return this;
    }
    range(from: number, to: number) {
      this.from = from;
      this.to = to;
      return this;
    }
    in(_column: string, ids: string[]) {
      this.ids = ids;
      return this;
    }
    upsert(rows: Row[]) {
      mockUpserts.push({ table: this.table, rows });
      return Promise.resolve({ error: mockUpsertError });
    }
    then(resolve: (value: { data: Row[]; error: null }) => unknown) {
      let rows = mockTables[this.table] ?? [];
      if (this.ids) rows = rows.filter((row) => this.ids!.includes(row.id as string));
      return Promise.resolve({ data: rows.slice(this.from, this.to + 1), error: null }).then(resolve);
    }
  }
  return {
    ensureSession: async () => undefined,
    supabase: { from: (table: string) => new Query(table) },
  };
});

const remoteStand = (index: number) => {
  const { id, name, owner_id, map_x, map_y, evento_id, zone_id } = DEMO_STANDS[index];
  return { id, name, owner_id, map_x, map_y, evento_id, zone_id };
};
const remoteZone = (index: number) => ({ ...DEMO_ZONES[index], current_capacity: 0 });
const remoteUser = (index: number) => ({
  ...DEMO_USERS[index],
  linkedin_url: null,
  created_at: '2026-11-15T09:00:00.000Z',
});
const ACCESS_LOG = {
  id: 'a0000000-0000-4000-8000-000000000001',
  user_id: DEMO_USERS[0].id,
  zone_id: DEMO_ZONES[0].id,
  action: 'ENTRY',
  timestamp: '2026-11-15T10:00:00.000Z',
};

describe('[US-03.4] adaptador remoto del plano (SupabaseMapDataSource)', () => {
  const source = new SupabaseMapDataSource();

  beforeEach(() => {
    for (const key of Object.keys(mockTables)) delete mockTables[key];
    mockUpserts.length = 0;
    mockUpsertError = null;
    mockTables.stands = [remoteStand(0), remoteStand(2)];
    mockTables.zones = [remoteZone(0), remoteZone(1)];
    mockTables.access_logs = [ACCESS_LOG];
    mockTables.users = DEMO_USERS.map((_, index) => remoteUser(index));
  });

  it('[US-03.4] descarga estands, zonas y accesos y los marca como sincronizados', async () => {
    const snapshot = await source.fetchSnapshot();

    expect(snapshot.stands.map((stand) => stand.id)).toEqual([DEMO_STANDS[0].id, DEMO_STANDS[2].id]);
    expect(snapshot.stands.every((stand) => stand.sync_status === 'SYNCED')).toBe(true);
    expect(snapshot.zones).toEqual([remoteZone(0), remoteZone(1)]);
    expect(snapshot.access_logs).toEqual([ACCESS_LOG]);
  });

  it('[US-03.4] solo descarga los usuarios que aparecen como dueños o en los accesos', async () => {
    const snapshot = await source.fetchSnapshot();

    // Dueño del estand 0 (expositor) y usuario del registro de acceso.
    expect(snapshot.users.map((user) => user.id).sort()).toEqual(
      [DEMO_STANDS[0].owner_id, ACCESS_LOG.user_id].sort(),
    );
  });

  it('[US-03.4] lee todas las páginas de una tabla grande', async () => {
    mockTables.access_logs = Array.from({ length: 1201 }, (_, index) => ({
      ...ACCESS_LOG,
      id: `a0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));

    const snapshot = await source.fetchSnapshot();

    expect(snapshot.access_logs).toHaveLength(1201);
  });

  it.each([
    ['un estand sin UUID válido', 'stands', { ...remoteStand(0), id: 'estand-1' }, 'estand con datos inválidos'],
    ['un estand sin evento', 'stands', { ...remoteStand(0), evento_id: null }, 'estand con datos inválidos'],
    ['una zona con aforo no entero', 'zones', { ...remoteZone(0), max_capacity: 10.5 }, 'zona con datos inválidos'],
    ['una zona con un rol desconocido', 'zones', { ...remoteZone(0), required_role: 'ADMIN' }, 'zona con datos inválidos'],
    ['un acceso con acción desconocida', 'access_logs', { ...ACCESS_LOG, action: 'JUMP' }, 'registro de acceso con datos inválidos'],
    ['un acceso con fecha inválida', 'access_logs', { ...ACCESS_LOG, timestamp: 'ayer' }, 'registro de acceso con datos inválidos'],
  ])('[US-03.4] rechaza %s sin tocar los datos locales', async (_case, table, row, message) => {
    mockTables[table] = [row];

    await expect(source.fetchSnapshot()).rejects.toThrow(message);
  });

  it('[US-03.4] rechaza un usuario relacionado con datos inválidos', async () => {
    mockTables.users = [{ ...remoteUser(9), role: null }];

    await expect(source.fetchSnapshot()).rejects.toThrow('usuario relacionado con datos inválidos');
  });

  it('[US-03.4] sube los estands pendientes sin el estado local de sincronización', async () => {
    const stand: Stand = { ...DEMO_STANDS[0], sync_status: 'PENDING' };

    await source.upsertStands([stand]);

    expect(mockUpserts).toHaveLength(1);
    expect(mockUpserts[0].table).toBe('stands');
    expect(mockUpserts[0].rows[0]).toEqual(remoteStand(0));
    expect(mockUpserts[0].rows[0]).not.toHaveProperty('sync_status');
  });

  it('[US-03.4] sin estands pendientes no llama a Supabase', async () => {
    await source.upsertStands([]);
    expect(mockUpserts).toHaveLength(0);
  });

  it('[US-03.4] un error de Supabase al subir se propaga para reintentar', async () => {
    mockUpsertError = { message: 'permission denied' };

    await expect(source.upsertStands([{ ...DEMO_STANDS[0], sync_status: 'PENDING' }])).rejects.toThrow(
      'No se pudieron sincronizar los estands pendientes: permission denied',
    );
  });
});
