/**
 * Puertos del módulo de Gamificación. Los implementan `src/database/` (SQLite),
 * `src/sync/` (Supabase), `src/lib/` (reloj, aleatoriedad, ids) y el bus de eventos.
 */
import type { EventBus } from '../events/eventBus.ts';
import type { GamificationEventMap, OccupancyLevel } from './events.ts';
import type {
  AttendeeFaction,
  Faction,
  GamificationConfig,
  IsoDateTime,
  PassportStamp,
  RouletteReward,
  RouletteSpin,
  SpinStatus,
  StandRating,
  StandTrivia,
  TriviaResult,
  UserAchievement,
  UUID,
  XpTransaction,
} from './types.ts';

/** Reloj inyectable: los casos de uso nunca llaman a `new Date()` directamente. */
export interface ClockPort {
  now(): Date;
}

/** Fuente de aleatoriedad inyectable (ruleta). */
export interface RandomPort {
  /** Número en [0, 1). */
  next(): number;
}

/** Generador de identificadores: UUID v4 creados en el cliente (sync idempotente, research.md R6). */
export interface IdGeneratorPort {
  uuid(): string;
}

/** Bus de eventos tipado con los eventos del módulo (contracts/domain-events.md). */
export type EventBusPort = EventBus<GamificationEventMap>;

/** Vista mínima de un estand que necesita la gamificación. */
export interface GamificationStand {
  id: UUID;
  name: string;
  /** `null` en estands antiguos sin evento asociado. */
  evento_id: UUID | null;
  /** `null` si el estand no está asignado a ninguna zona (nunca recibe ×2). */
  zone_id: UUID | null;
}

/** Vista mínima de un evento que necesita la gamificación. */
export interface GamificationEvento {
  id: UUID;
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string;
}

/** Tablas que se suben al servidor y llevan la marca local `synced`. */
export type SyncableGamificationTable =
  | 'attendee_factions'
  | 'user_stamps'
  | 'stand_ratings'
  | 'user_achievements'
  | 'roulette_spins'
  | 'xp_transactions';

/**
 * Persistencia local del módulo (SQLite). Toda escritura deja la fila con `synced = 0`;
 * solo `markSynced` la pasa a `1`.
 */
export interface GamificationRepositoryPort {
  /** Ejecuta `operation` en una transacción: si lanza, no se persiste nada. */
  withTransaction<T>(operation: () => Promise<T>): Promise<T>;

  getStand(standId: UUID): Promise<GamificationStand | null>;
  getEvento(eventoId: UUID): Promise<GamificationEvento | null>;
  getAttendeeFaction(userId: UUID, eventoId: UUID): Promise<AttendeeFaction | null>;

  getStamp(userId: UUID, standId: UUID): Promise<PassportStamp | null>;
  listStamps(userId: UUID, eventoId: UUID): Promise<PassportStamp[]>;
  insertStamp(stamp: PassportStamp): Promise<void>;

  getTrivia(standId: UUID): Promise<StandTrivia | null>;

  getRating(userId: UUID, standId: UUID): Promise<StandRating | null>;
  insertRating(rating: StandRating): Promise<void>;
  /** Valoraciones del asistente en los estands del evento. */
  listRatings(userId: UUID, eventoId: UUID): Promise<StandRating[]>;

  /** Inserta si no existe la clave `(source_type, reference_id)`. Devuelve si se insertó. */
  insertXpTransaction(transaction: XpTransaction): Promise<boolean>;
  sumXp(userId: UUID, eventoId: UUID): Promise<number>;

  /** Configuración del evento o los valores por defecto si no hay fila (o es inválida). */
  getConfig(eventoId: UUID): Promise<GamificationConfig>;
  /** Último nivel de aforo conocido de la zona; `null` si no hay ninguno en caché. */
  getZoneLevel(zoneId: UUID): Promise<OccupancyLevel | null>;

  listPendingAttendeeFactions(): Promise<AttendeeFaction[]>;
  listPendingStamps(): Promise<PassportStamp[]>;
  listPendingRatings(): Promise<StandRating[]>;
  listPendingAchievements(): Promise<UserAchievement[]>;
  listPendingSpins(): Promise<RouletteSpin[]>;
  listPendingXpTransactions(): Promise<XpTransaction[]>;
  markSynced(table: SyncableGamificationTable, ids: readonly UUID[]): Promise<void>;
}

/** Resolución de la trivia de un sello que ya se subió con `PENDING`. */
export interface StampTriviaUpdate {
  id: UUID;
  trivia_result: Exclude<TriviaResult, 'PENDING'>;
  trivia_answered_at: IsoDateTime | null;
}

/** Avance de estado de una tirada (el estado solo avanza: PENDING < SPUN < CONSUMED/CLAIMED). */
export interface RouletteSpinStatusUpdate {
  id: UUID;
  status: SpinStatus;
  reward_type: RouletteReward | null;
  spun_at: IsoDateTime | null;
  resolved_at: IsoDateTime | null;
}

/** Fila de la view remota `stand_ranking`. */
export interface RemoteStandRankingRow {
  evento_id: UUID;
  stand_id: UUID;
  bayesian_score: number;
  average_stars: number | null;
  rating_count: number;
  stamp_count: number;
}

/** Fila de la view remota `faction_scores`. */
export interface RemoteFactionScoreRow {
  evento_id: UUID;
  faction_id: UUID;
  total_xp: number;
  member_count: number;
}

/**
 * Servidor central de la gamificación (contracts/supabase-sync.md).
 * Las subidas son idempotentes (`INSERT … ON CONFLICT DO NOTHING` por clave natural):
 * repetirlas tras un fallo no duplica nada. Las filas nunca llevan `synced`.
 */
export interface GamificationRemotePort {
  uploadAttendeeFactions(rows: readonly AttendeeFaction[]): Promise<void>;
  uploadUserStamps(rows: readonly PassportStamp[]): Promise<void>;
  /** Solo actualiza filas remotas que siguen en `PENDING`. */
  updateStampTrivia(rows: readonly StampTriviaUpdate[]): Promise<void>;
  uploadStandRatings(rows: readonly StandRating[]): Promise<void>;
  uploadUserAchievements(rows: readonly UserAchievement[]): Promise<void>;
  uploadRouletteSpins(rows: readonly RouletteSpin[]): Promise<void>;
  updateRouletteSpinStatus(rows: readonly RouletteSpinStatusUpdate[]): Promise<void>;
  /** Siempre la última subida: referencia a las filas anteriores. */
  uploadXpTransactions(rows: readonly XpTransaction[]): Promise<void>;

  downloadFactions(eventoId: UUID): Promise<Faction[]>;
  downloadStandTrivia(eventoId: UUID): Promise<StandTrivia[]>;
  downloadConfig(eventoId: UUID): Promise<GamificationConfig | null>;
  downloadStandRanking(eventoId: UUID): Promise<RemoteStandRankingRow[]>;
  downloadFactionScores(eventoId: UUID): Promise<RemoteFactionScoreRow[]>;
}

/**
 * Puerto de consulta, de solo lectura, para la pantalla de Ranking y el Dashboard de
 * organización (contracts/ranking-projection-port.md). Nunca accede a la red.
 */

export interface StandRankingEntry {
  standId: string;
  standName: string;
  position: number;        // 1-based
  bayesianScore: number;   // 0..5, 2 decimales
  averageStars: number | null;
  ratingCount: number;
  stampCount: number;
}

export interface FactionScore {
  factionId: string;
  name: string;
  colorHex: string;
  totalXp: number;
  memberCount: number;
}

export interface IRankingProjectionPort {
  getStandRanking(eventoId: string): Promise<StandRankingEntry[]>;
  getFactionScores(eventoId: string): Promise<FactionScore[]>;
  /** Hora de la última proyección bajada del servidor; null si nunca se ha sincronizado. */
  getLastUpdatedAt(eventoId: string): Promise<string | null>;
}
