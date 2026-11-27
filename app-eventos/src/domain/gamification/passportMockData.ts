import type { PassportStampCardData, PassportViewData } from './passportView';

/**
 * Datos mock del pasaporte (Spec 09). Sin imports de React Native ni Expo.
 * Se sustituirán por `usePassport` (T031).
 */
export type EscenarioPasaporte = 'sinEstands' | 'sinSellos' | 'parcial' | 'completo';

const STAND_IDS = [
  '00000000-0000-4000-9000-000000000001',
  '00000000-0000-4000-9000-000000000002',
  '00000000-0000-4000-9000-000000000003',
  '00000000-0000-4000-9000-000000000004',
  '00000000-0000-4000-9000-000000000005',
  '00000000-0000-4000-9000-000000000006',
  '00000000-0000-4000-9000-000000000007',
  '00000000-0000-4000-9000-000000000008',
] as const;

/** Sellos desbloqueados de todos los estands (el nombre largo prueba `numberOfLines={2}`). */
const SELLOS_DESBLOQUEADOS: PassportStampCardData[] = [
  {
    estado: 'DESBLOQUEADO',
    standId: STAND_IDS[0],
    standName: 'Estand Café',
    scannedAt: '2026-11-27T09:32:00.000Z',
    xpGanada: 100,
    estrellas: 4,
  },
  {
    estado: 'DESBLOQUEADO',
    standId: STAND_IDS[1],
    standName: 'Robótica Educativa y Programación para Todas las Edades',
    scannedAt: '2026-11-27T10:05:00.000Z',
    xpGanada: 150,
    estrellas: null,
  },
  {
    estado: 'DESBLOQUEADO',
    standId: STAND_IDS[2],
    standName: 'Realidad Virtual',
    scannedAt: '2026-11-27T11:18:00.000Z',
    xpGanada: 100,
    estrellas: 5,
  },
  {
    estado: 'DESBLOQUEADO',
    standId: STAND_IDS[3],
    standName: 'Startups Locales',
    scannedAt: '2026-11-27T11:47:00.000Z',
    xpGanada: 100,
    estrellas: 3,
  },
  {
    estado: 'DESBLOQUEADO',
    standId: STAND_IDS[4],
    standName: 'Ciberseguridad',
    scannedAt: '2026-11-27T12:20:00.000Z',
    xpGanada: 200,
    estrellas: 5,
  },
  {
    estado: 'DESBLOQUEADO',
    standId: STAND_IDS[5],
    standName: 'Videojuegos Indie',
    scannedAt: '2026-11-27T13:02:00.000Z',
    xpGanada: 100,
    estrellas: 2,
  },
  {
    estado: 'DESBLOQUEADO',
    standId: STAND_IDS[6],
    standName: 'Impresión 3D',
    scannedAt: '2026-11-27T15:40:00.000Z',
    xpGanada: 100,
    estrellas: 4,
  },
  {
    estado: 'DESBLOQUEADO',
    standId: STAND_IDS[7],
    standName: 'Energías Renovables',
    scannedAt: '2026-11-27T16:15:00.000Z',
    xpGanada: 150,
    estrellas: 1,
  },
];

const SELLOS_BLOQUEADOS: PassportStampCardData[] = STAND_IDS.map((standId) => ({
  estado: 'BLOQUEADO',
  standId,
}));

export const ESCENARIOS_PASAPORTE: Record<EscenarioPasaporte, PassportViewData> = {
  sinEstands: { xpTotal: 0, sellos: [] },
  sinSellos: { xpTotal: 0, sellos: SELLOS_BLOQUEADOS },
  // 8 estands y 3 sellos (el segundo sin valorar). El XP total incluye trivia y valoraciones.
  parcial: {
    xpTotal: 420,
    sellos: [...SELLOS_DESBLOQUEADOS.slice(0, 3), ...SELLOS_BLOQUEADOS.slice(3)],
  },
  completo: { xpTotal: 1350, sellos: SELLOS_DESBLOQUEADOS },
};

export const ESCENARIO_POR_DEFECTO: EscenarioPasaporte = 'parcial';
