import type { OccupancyLevel } from './mapTypes';

export interface OccupancyStatus {
  /** Texto visible del nivel: el semáforo nunca depende solo del color. */
  label: string;
  /** Icono del nivel, distinto para cada uno (se lee sin distinguir colores). */
  icon: string;
  /** Color del semáforo. */
  color: string;
}

/**
 * Presentación de cada nivel del semáforo de aforo (Spec 03 / Spec 06): color, icono y texto.
 * Sin dependencias de React Native para poder probarla con Node.
 */
export const OCCUPANCY_STATUS: Record<OccupancyLevel, OccupancyStatus> = {
  available: { label: 'Disponible', icon: '✓', color: '#23804F' },
  medium: { label: 'Ocupación media', icon: '!', color: '#A85F08' },
  full: { label: 'Completo', icon: '✕', color: '#C0392B' },
  unavailable: { label: 'Sin datos', icon: '?', color: '#66716C' },
};

export function getOccupancyStatus(level: OccupancyLevel): OccupancyStatus {
  return OCCUPANCY_STATUS[level];
}
