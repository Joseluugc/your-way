import type { Stand, Zone } from './mapTypes';

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
    name: 'Auditorio Principal',
    max_capacity: 200,
    current_capacity: 45,
    required_role: 'ATTENDEE',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440012',
    name: 'Zona VIP',
    max_capacity: 50,
    current_capacity: 12,
    required_role: 'VIP',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440013',
    name: 'Talleres',
    max_capacity: 80,
    current_capacity: 0,
    required_role: 'STAFF',
  },
];
