import type { AccessLog, Stand, Zone } from './mapTypes';

export const MAP_SEED_EVENT_IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
] as const;

export interface MapSeedEvent {
  id: string;
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion: string;
  descripcion: string;
}

export const MAP_SEED_EVENTS: MapSeedEvent[] = [
  {
    id: MAP_SEED_EVENT_IDS[0],
    titulo: 'Presentación Your Way',
    fecha_inicio: '2026-11-15T10:00:00.000Z',
    fecha_fin: '2026-11-15T11:30:00.000Z',
    ubicacion: 'Auditorio Principal',
    descripcion: 'Evento de ejemplo para validar el mapa y la gestión de estands.',
  },
  {
    id: MAP_SEED_EVENT_IDS[1],
    titulo: 'Taller de Networking',
    fecha_inicio: '2026-11-15T12:30:00.000Z',
    fecha_fin: '2026-11-15T14:00:00.000Z',
    ubicacion: 'Zona VIP & Lounge',
    descripcion: 'Segundo evento de ejemplo con sus propios estands.',
  },
];

export const MAP_MOCK_STANDS: Stand[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Innovación Digital',
    owner_id: '550e8400-e29b-41d4-a716-446655440101',
    map_x: 12.5,
    map_y: 18,
    evento_id: MAP_SEED_EVENT_IDS[0],
    zone_id: '550e8400-e29b-41d4-a716-446655440011',
    sync_status: 'SYNCED',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Tecnología Verde',
    owner_id: '550e8400-e29b-41d4-a716-446655440102',
    map_x: 38,
    map_y: 31.5,
    evento_id: MAP_SEED_EVENT_IDS[0],
    zone_id: '550e8400-e29b-41d4-a716-446655440012',
    sync_status: 'SYNCED',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Laboratorio Creativo',
    owner_id: null,
    map_x: 68,
    map_y: 22,
    evento_id: MAP_SEED_EVENT_IDS[1],
    zone_id: '550e8400-e29b-41d4-a716-446655440013',
    sync_status: 'SYNCED',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    name: 'Punto de Encuentro',
    owner_id: null,
    map_x: 89.5,
    map_y: 43,
    evento_id: MAP_SEED_EVENT_IDS[1],
    zone_id: '550e8400-e29b-41d4-a716-446655440011',
    sync_status: 'SYNCED',
  },
];

export const MAP_MOCK_ZONES: Zone[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440011',
    name: 'Sala al 69%',
    max_capacity: 100,
    current_capacity: 69,
    required_role: 'ATTENDEE',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440012',
    name: 'Sala al 70%',
    max_capacity: 100,
    current_capacity: 70,
    required_role: 'ATTENDEE',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440013',
    name: 'Sala al 94%',
    max_capacity: 100,
    current_capacity: 94,
    required_role: 'ATTENDEE',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440014',
    name: 'Sala al 95%',
    max_capacity: 100,
    current_capacity: 95,
    required_role: 'ATTENDEE',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440015',
    name: 'Aforo inválido',
    max_capacity: 0,
    current_capacity: 1,
    required_role: 'ATTENDEE',
  },
];

export const MAP_MOCK_ACCESS_LOGS: AccessLog[] = [
  ...createEntryLogs(MAP_MOCK_ZONES[0].id, 69, 1),
  ...createEntryLogs(MAP_MOCK_ZONES[1].id, 70, 70),
  ...createEntryLogs(MAP_MOCK_ZONES[2].id, 94, 140),
  ...createEntryLogs(MAP_MOCK_ZONES[3].id, 95, 234),
  ...createEntryLogs(MAP_MOCK_ZONES[4].id, 1, 329),
];

function createEntryLogs(zoneId: string, count: number, firstId: number): AccessLog[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `650e8400-e29b-41d4-a716-${String(firstId + index).padStart(12, '0')}`,
    user_id: null,
    zone_id: zoneId,
    action: 'ENTRY',
    timestamp: new Date(Date.UTC(2026, 10, 19, 10, firstId + index)).toISOString(),
  }));
}
