import type { Stand, UUID, UserRole } from './mapTypes';

export interface ManageStandInput {
  id?: UUID;
  name: string;
  owner_id?: UUID | null;
  map_x: number;
  map_y: number;
  evento_id: UUID;
  /** Zona del estand. Vacío o `null` conserva la zona que ya tuviera guardada. */
  zone_id?: UUID | null;
}

export interface ManageStandRepositoryPort {
  saveStand(stand: Stand): Promise<void>;
}

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createOrUpdateStand(
  activeRole: UserRole,
  input: ManageStandInput,
  repository: ManageStandRepositoryPort,
  generateId: () => UUID = generateUuidV4,
): Promise<Stand> {
  if (activeRole !== 'STAFF') {
    throw new Error('No tienes autorización para gestionar estands. Se requiere el rol STAFF.');
  }

  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error('Escribe un nombre para el estand.');
  }
  if (name.length > 100) {
    throw new Error('El nombre del estand no puede superar los 100 caracteres.');
  }
  if (!isCoordinate(input.map_x) || !isCoordinate(input.map_y)) {
    throw new Error('Elige una posición válida dentro del plano (coordenadas entre 0 y 100).');
  }
  if (!UUID_V4_PATTERN.test(input.evento_id)) {
    throw new Error('Selecciona un evento válido para el estand.');
  }
  if (
    input.owner_id !== undefined &&
    input.owner_id !== null &&
    !UUID_V4_PATTERN.test(input.owner_id)
  ) {
    throw new Error('El identificador del propietario no es válido.');
  }
  if (
    input.zone_id !== undefined &&
    input.zone_id !== null &&
    !UUID_V4_PATTERN.test(input.zone_id)
  ) {
    throw new Error('El identificador de la zona no es válido.');
  }
  if (input.id !== undefined && !UUID_V4_PATTERN.test(input.id)) {
    throw new Error('El identificador del estand no es válido.');
  }

  const stand: Stand = {
    id: input.id ?? generateId(),
    name,
    owner_id: input.owner_id ?? null,
    map_x: input.map_x,
    map_y: input.map_y,
    evento_id: input.evento_id,
    zone_id: input.zone_id ?? null,
    sync_status: 'PENDING',
  };
  await repository.saveStand(stand);
  return stand;
}

export function generateUuidV4(): UUID {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = character === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isCoordinate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}
