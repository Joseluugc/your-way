import type { AccessLog, Stand, UserRole, Zone } from '../domain/map/mapTypes';
import type {
  MapRemoteDataSource,
  MapSyncUser,
  RemoteMapSnapshot,
} from '../domain/map/syncMapAndOccupancy';
import { ensureSession, supabase } from '../lib/supabase';

const PAGE_SIZE = 500;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_ROLES: readonly UserRole[] = ['ATTENDEE', 'VIP', 'STAFF', 'EXHIBITOR'];

export class SupabaseMapDataSource implements MapRemoteDataSource {
  async fetchSnapshot(): Promise<RemoteMapSnapshot> {
    await ensureSession();
    const [standRows, zoneRows, accessLogRows] = await Promise.all([
      fetchTableRows('stands', 'id, name, owner_id, map_x, map_y, evento_id'),
      fetchTableRows('zones', 'id, name, max_capacity, current_capacity, required_role'),
      fetchTableRows('access_logs', 'id, user_id, zone_id, action, timestamp'),
    ]);
    const stands = standRows.map(parseStand);
    const accessLogs = accessLogRows.map(parseAccessLog);
    const userIds = [
      ...new Set([
        ...stands.flatMap((stand) => (stand.owner_id ? [stand.owner_id] : [])),
        ...accessLogs.flatMap((accessLog) => (accessLog.user_id ? [accessLog.user_id] : [])),
      ]),
    ];

    return {
      stands,
      zones: zoneRows.map(parseZone),
      access_logs: accessLogs,
      users: await fetchReferencedUsers(userIds),
    };
  }

  async upsertStands(stands: readonly Stand[]): Promise<void> {
    if (stands.length === 0) {
      return;
    }

    await ensureSession();
    const rows = stands.map(({ id, name, owner_id, map_x, map_y, evento_id }) => ({
      id,
      name,
      owner_id,
      map_x,
      map_y,
      evento_id,
    }));
    const { error } = await supabase.from('stands').upsert(rows, { onConflict: 'id' });
    if (error) {
      throw new Error(`No se pudieron sincronizar los estands pendientes: ${error.message}`);
    }
  }
}

async function fetchTableRows(table: string, columns: string): Promise<unknown[]> {
  const rows: unknown[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`No se pudo sincronizar la tabla ${table}: ${error.message}`);
    }

    const page: unknown = data;
    if (!Array.isArray(page)) {
      throw new Error(`La respuesta remota de ${table} no tiene el formato esperado.`);
    }
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

async function fetchReferencedUsers(ids: string[]): Promise<MapSyncUser[]> {
  const users: MapSyncUser[] = [];

  for (let offset = 0; offset < ids.length; offset += PAGE_SIZE) {
    const pageIds = ids.slice(offset, offset + PAGE_SIZE);
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, company, linkedin_url, created_at')
      .in('id', pageIds);
    if (error) {
      throw new Error(`No se pudieron sincronizar los usuarios relacionados: ${error.message}`);
    }

    const rows: unknown = data;
    if (!Array.isArray(rows)) {
      throw new Error('La respuesta remota de usuarios no tiene el formato esperado.');
    }
    users.push(...rows.map(parseMapUser));
  }

  return users;
}

function parseStand(value: unknown): Stand {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    typeof value.name !== 'string' ||
    !isNullableUuid(value.owner_id) ||
    typeof value.map_x !== 'number' ||
    !Number.isFinite(value.map_x) ||
    typeof value.map_y !== 'number' ||
    !Number.isFinite(value.map_y) ||
    !isUuid(value.evento_id)
  ) {
    throw new Error('La respuesta remota contiene un estand con datos inválidos.');
  }

  return {
    id: value.id,
    name: value.name,
    owner_id: value.owner_id,
    map_x: value.map_x,
    map_y: value.map_y,
    evento_id: value.evento_id,
    sync_status: 'SYNCED',
  };
}

function parseZone(value: unknown): Zone {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    typeof value.name !== 'string' ||
    typeof value.max_capacity !== 'number' ||
    !Number.isInteger(value.max_capacity) ||
    !isNullableInteger(value.current_capacity) ||
    !isUserRole(value.required_role)
  ) {
    throw new Error('La respuesta remota contiene una zona con datos inválidos.');
  }

  return {
    id: value.id,
    name: value.name,
    max_capacity: value.max_capacity,
    current_capacity: value.current_capacity,
    required_role: value.required_role,
  };
}

function parseAccessLog(value: unknown): AccessLog {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    !isNullableUuid(value.user_id) ||
    !isNullableUuid(value.zone_id) ||
    (value.action !== 'ENTRY' && value.action !== 'EXIT') ||
    !isNullableTimestamp(value.timestamp)
  ) {
    throw new Error('La respuesta remota contiene un registro de acceso con datos inválidos.');
  }

  return {
    id: value.id,
    user_id: value.user_id,
    zone_id: value.zone_id,
    action: value.action,
    timestamp: value.timestamp,
  };
}

function parseMapUser(value: unknown): MapSyncUser {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    typeof value.name !== 'string' ||
    typeof value.email !== 'string' ||
    !isUserRole(value.role) ||
    value.role === null ||
    !isNullableString(value.company) ||
    !isNullableString(value.linkedin_url) ||
    !isNullableTimestamp(value.created_at)
  ) {
    throw new Error('La respuesta remota contiene un usuario relacionado con datos inválidos.');
  }

  return {
    id: value.id,
    name: value.name,
    email: value.email,
    role: value.role,
    company: value.company,
    linkedin_url: value.linkedin_url,
    created_at: value.created_at,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_PATTERN.test(value);
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value));
}

function isNullableTimestamp(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && Number.isFinite(Date.parse(value)))
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isUserRole(value: unknown): value is UserRole | null {
  return value === null || USER_ROLES.some((role) => role === value);
}
