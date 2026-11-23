/**
 * Eventos de dominio del módulo de Gamificación (contracts/domain-events.md).
 * Otros módulos pueden importar SOLO estos tipos.
 * Todos los payloads llevan `v: 1` y las fechas son strings ISO 8601 en UTC.
 */
import type { OccupancyLevel } from '../map/mapTypes.ts';

export type { OccupancyLevel };

// --- Eventos de entrada (los consume Gamificación) ---

/** Productor: NFC Puerta (Hugo). Efecto: `assignFaction`. */
export interface AttendeeWristbandWritten {
  v: 1;
  /** Asistente vinculado a la pulsera. */
  userId: string;
  eventoId: string;
  /** UID NDEF de la pulsera. */
  wristbandUid: string;
  writtenAt: string;
}

/** Productor: Lectura NFC (Hugo). Efecto: `handleStandScanned`. */
export interface StandNfcScanned {
  v: 1;
  /** Asistente que escanea (lo resuelve el módulo NFC). */
  userId: string;
  /** Resuelto a partir de `nfc_tags` (`type = 'STAND_POINT'`). */
  standId: string;
  tagUid: string;
  scannedAt: string;
}

/** Productor: Mapa/Aforo (Rafa). Efecto: `handleZoneOccupancyChanged`. */
export interface ZoneOccupancyChanged {
  v: 1;
  zoneId: string;
  zoneName: string;
  previousLevel: OccupancyLevel | null;
  level: OccupancyLevel;
  occurredAt: string;
}

// --- Eventos de salida (los publica Gamificación) ---

/** Consumidor: Notificaciones (Rafa). */
export interface FlashMissionAlertRequested {
  v: 1;
  /** UUID; sirve para deduplicar en el consumidor. */
  alertId: string;
  zoneId: string;
  zoneName: string;
  multiplier: 2;
  requestedAt: string;
}

export type HapticFeedbackKind = 'STAMP_SUCCESS' | 'ACHIEVEMENT_UNLOCKED' | 'ROULETTE_WIN';

/** Consumidor: Accesibilidad (Javi). */
export interface HapticFeedbackRequested {
  v: 1;
  kind: HapticFeedbackKind;
  requestedAt: string;
}

export type StarRating = 1 | 2 | 3 | 4 | 5;

/** Consumidor: Dashboard (Joselu). Se publica tras persistir en local. */
export interface StandRatingSubmitted {
  v: 1;
  ratingId: string;
  userId: string;
  standId: string;
  eventoId: string;
  stars: StarRating;
  submittedAt: string;
}

/** Mapa nombre → payload de los eventos públicos del módulo. */
export interface GamificationEventMap {
  AttendeeWristbandWritten: AttendeeWristbandWritten;
  StandNfcScanned: StandNfcScanned;
  ZoneOccupancyChanged: ZoneOccupancyChanged;
  FlashMissionAlertRequested: FlashMissionAlertRequested;
  HapticFeedbackRequested: HapticFeedbackRequested;
  StandRatingSubmitted: StandRatingSubmitted;
}

export type GamificationEventName = keyof GamificationEventMap;
