/**
 * Datos de la demo en vivo (Spec 06, US-06.1).
 *
 * Fuente única de los UUID fijos: los carga la base local en modo desarrollo
 * (`seedDevData`) y deben coincidir con `supabase/seed.sql`. El test
 * `tests/demoSeed.test.mjs` falla si ambos divergen.
 *
 * Los UUID siguen el formato v4 (versión 4, variante 8) con un prefijo por entidad:
 * d1 = usuarios, d2 = zonas, d3 = estands, d4 = etiquetas NFC.
 */
import { MAP_SEED_EVENTS } from '../domain/map/mapMockData.ts';
import type { UserRole } from '../domain/map/mapTypes.ts';

export type NfcTagType = 'USER_WRISTBAND' | 'STAND_POINT' | 'ZONE_CHECKPOINT';

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company: string | null;
}

export interface DemoZone {
  id: string;
  name: string;
  max_capacity: number;
  required_role: UserRole;
}

export interface DemoStand {
  id: string;
  name: string;
  owner_id: string | null;
  map_x: number;
  map_y: number;
  evento_id: string;
  zone_id: string;
}

export interface DemoNfcTag {
  id: string;
  uid: string;
  type: NfcTagType;
  user_id: string | null;
  stand_id: string | null;
  zone_id: string | null;
}

/** Evento al que pertenecen los estands de la demo (ya existe en local desde la migración 3). */
export const DEMO_EVENTO = MAP_SEED_EVENTS[0];

const uuid = (prefix: string, n: number) =>
  `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const nfcUid = (group: string, n: number) =>
  `04:${group}:00:00:00:${n.toString(16).toUpperCase().padStart(2, '0')}`;

export const DEMO_USERS: DemoUser[] = [
  { id: uuid('d1', 1), name: 'Ana Gómez', email: 'ana.gomez@yourway.demo', role: 'ATTENDEE', company: null },
  { id: uuid('d1', 2), name: 'Luis Martín', email: 'luis.martin@yourway.demo', role: 'ATTENDEE', company: null },
  { id: uuid('d1', 3), name: 'Lucía Fernández', email: 'lucia.fernandez@yourway.demo', role: 'ATTENDEE', company: 'Universidad de Córdoba' },
  { id: uuid('d1', 4), name: 'Pablo Ruiz', email: 'pablo.ruiz@yourway.demo', role: 'ATTENDEE', company: null },
  { id: uuid('d1', 5), name: 'Sara Molina', email: 'sara.molina@yourway.demo', role: 'ATTENDEE', company: 'StartUp Lab' },
  { id: uuid('d1', 6), name: 'María López', email: 'maria.lopez@yourway.demo', role: 'VIP', company: 'Inversores Sur' },
  { id: uuid('d1', 7), name: 'Javier Torres', email: 'javier.torres@yourway.demo', role: 'VIP', company: 'Ayuntamiento' },
  { id: uuid('d1', 8), name: 'Elena Navarro', email: 'elena.navarro@yourway.demo', role: 'STAFF', company: 'Your Way' },
  { id: uuid('d1', 9), name: 'Diego Castro', email: 'diego.castro@yourway.demo', role: 'STAFF', company: 'Your Way' },
  { id: uuid('d1', 10), name: 'Carlos Ruiz', email: 'carlos.ruiz@yourway.demo', role: 'EXHIBITOR', company: 'Tech Solutions' },
];

const EXHIBITOR_ID = uuid('d1', 10);

/**
 * Usuario solo de desarrollo, sin pulsera: permite probar la vinculación de una pulsera nueva
 * (prueba de concepto NFC de la Spec 02). No está en `supabase/seed.sql`, donde cada usuario
 * de la demo tiene su pulsera.
 */
export const DEV_USERS_WITHOUT_WRISTBAND: DemoUser[] = [
  { id: uuid('d5', 1), name: 'Marta Sánchez', email: 'marta.sanchez@yourway.demo', role: 'ATTENDEE', company: null },
];

export const DEMO_ZONES: DemoZone[] = [
  { id: uuid('d2', 1), name: 'Pabellón General', max_capacity: 300, required_role: 'ATTENDEE' },
  { id: uuid('d2', 2), name: 'Zona VIP & Lounge', max_capacity: 50, required_role: 'VIP' },
  { id: uuid('d2', 3), name: 'Backstage Staff', max_capacity: 20, required_role: 'STAFF' },
];

/** Coordenadas en el sistema del plano (`map-units-0-100`). */
export const DEMO_STANDS: DemoStand[] = [
  { id: uuid('d3', 1), name: 'Tech Solutions', owner_id: EXHIBITOR_ID, map_x: 20, map_y: 62, evento_id: DEMO_EVENTO.id, zone_id: uuid('d2', 1) },
  { id: uuid('d3', 2), name: 'AI & Data Lab', owner_id: EXHIBITOR_ID, map_x: 42, map_y: 74, evento_id: DEMO_EVENTO.id, zone_id: uuid('d2', 1) },
  { id: uuid('d3', 3), name: 'Rincón Sostenible', owner_id: null, map_x: 66, map_y: 60, evento_id: DEMO_EVENTO.id, zone_id: uuid('d2', 1) },
  { id: uuid('d3', 4), name: 'Lounge Partners', owner_id: null, map_x: 84, map_y: 78, evento_id: DEMO_EVENTO.id, zone_id: uuid('d2', 2) },
];

/** Una pulsera por usuario, un punto por estand y un control por zona. */
export const DEMO_NFC_TAGS: DemoNfcTag[] = [
  ...DEMO_USERS.map((user, index) => ({
    id: uuid('d4', index + 1),
    uid: nfcUid('A1', index + 1),
    type: 'USER_WRISTBAND' as const,
    user_id: user.id,
    stand_id: null,
    zone_id: null,
  })),
  ...DEMO_STANDS.map((stand, index) => ({
    id: uuid('d4', 101 + index),
    uid: nfcUid('B1', index + 1),
    type: 'STAND_POINT' as const,
    user_id: null,
    stand_id: stand.id,
    zone_id: null,
  })),
  ...DEMO_ZONES.map((zone, index) => ({
    id: uuid('d4', 201 + index),
    uid: nfcUid('C1', index + 1),
    type: 'ZONE_CHECKPOINT' as const,
    user_id: null,
    stand_id: null,
    zone_id: zone.id,
  })),
];
