import type { AccessLog, Stand, Zone } from './mapTypes';

export const MAP_MOCK_STANDS: Stand[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Innovación Digital',
    owner_id: '550e8400-e29b-41d4-a716-446655440101',
    map_x: 12.5,
    map_y: 18,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Tecnología Verde',
    owner_id: '550e8400-e29b-41d4-a716-446655440102',
    map_x: 38,
    map_y: 31.5,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Laboratorio Creativo',
    owner_id: null,
    map_x: 68,
    map_y: 22,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    name: 'Punto de Encuentro',
    owner_id: null,
    map_x: 89.5,
    map_y: 43,
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
