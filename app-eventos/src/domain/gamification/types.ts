/**
 * Entidades y value objects del módulo de Gamificación (data-model.md).
 * Los nombres de campo siguen las columnas de la BD (snake_case), como el resto de entidades
 * del repo (`Stand`, `Zone`…). Las columnas `synced` son un detalle local de persistencia
 * y no forman parte de las entidades.
 */
import type { OccupancyLevel, StarRating } from './events.ts';

export type UUID = string;
/** Fecha ISO 8601 en UTC. */
export type IsoDateTime = string;

export type XpSource = 'STAMP' | 'TRIVIA' | 'RATING' | 'ACHIEVEMENT' | 'ROULETTE';

export type TriviaResult = 'PENDING' | 'CORRECT' | 'WRONG' | 'TIMEOUT' | 'SKIPPED';

export type AchievementCode = 'EARLY_BIRD' | 'EXPERT_CRITIC' | 'SECTOR_EXPLORER' | 'SPEEDRUNNER';

export type RouletteReward = 'XP_200' | 'MULTIPLIER_1_5' | 'RAFFLE_TICKET' | 'PHYSICAL_PRIZE';

export type SpinStatus = 'PENDING' | 'SPUN' | 'CONSUMED' | 'CLAIMED';

export const XP_SOURCES: readonly XpSource[] = ['STAMP', 'TRIVIA', 'RATING', 'ACHIEVEMENT', 'ROULETTE'];
export const TRIVIA_RESULTS: readonly TriviaResult[] = [
  'PENDING',
  'CORRECT',
  'WRONG',
  'TIMEOUT',
  'SKIPPED',
];
export const ACHIEVEMENT_CODES: readonly AchievementCode[] = [
  'EARLY_BIRD',
  'EXPERT_CRITIC',
  'SECTOR_EXPLORER',
  'SPEEDRUNNER',
];
export const ROULETTE_REWARDS: readonly RouletteReward[] = [
  'XP_200',
  'MULTIPLIER_1_5',
  'RAFFLE_TICKET',
  'PHYSICAL_PRIZE',
];
export const SPIN_STATUSES: readonly SpinStatus[] = ['PENDING', 'SPUN', 'CONSUMED', 'CLAIMED'];

/** `factions`: la crea la organización; solo se descarga. */
export interface Faction {
  id: UUID;
  evento_id: UUID;
  name: string;
  /** `#RRGGBB`. */
  color_hex: string;
}

/** `attendee_factions`: inmutable; una por asistente y evento. */
export interface AttendeeFaction {
  id: UUID;
  user_id: UUID;
  evento_id: UUID;
  faction_id: UUID;
  assigned_at: IsoDateTime;
}

/** `stand_trivia`: como mucho una por estand; solo se descarga. */
export interface StandTrivia {
  id: UUID;
  stand_id: UUID;
  /** ≤ 200 caracteres. */
  question: string;
  /** Exactamente 3 opciones no vacías. */
  options: [string, string, string];
  correct_option_index: 0 | 1 | 2;
  /** > 0; por defecto 50. */
  bonus_xp: number;
}

/** `user_stamps`: un sello por asistente y estand (FR-001). */
export interface PassportStamp {
  id: UUID;
  user_id: UUID;
  stand_id: UUID;
  evento_id: UUID;
  scanned_at: IsoDateTime;
  /** Nivel de aforo de la zona del estand en el instante del escaneo; `null` si no tiene zona. */
  zone_level_at_scan: OccupancyLevel | null;
  /** zona × personal ∈ {1.0, 1.5, 2.0, 3.0}. */
  applied_multiplier: number;
  trivia_result: TriviaResult;
  trivia_answered_at: IsoDateTime | null;
}

/** `stand_ratings`: inmutable; una por asistente y estand. */
export interface StandRating {
  id: UUID;
  user_id: UUID;
  stand_id: UUID;
  stars: StarRating;
  created_at: IsoDateTime;
}

/** `xp_transactions`: libro mayor append-only. */
export interface XpTransaction {
  id: UUID;
  user_id: UUID;
  /** `null` si el asistente aún no tiene facción. */
  faction_id: UUID | null;
  evento_id: UUID;
  source_type: XpSource;
  /** Id del sello (STAMP, TRIVIA), valoración, logro o tirada. */
  reference_id: UUID;
  base_xp: number;
  multiplier: number;
  final_xp: number;
  created_at: IsoDateTime;
}

/** `user_achievements`: inmutable; cada insignia una vez por asistente y evento. */
export interface UserAchievement {
  id: UUID;
  user_id: UUID;
  evento_id: UUID;
  code: AchievementCode;
  unlocked_at: IsoDateTime;
}

/** `roulette_spins`: una por cada múltiplo de X sellos. */
export interface RouletteSpin {
  id: UUID;
  user_id: UUID;
  evento_id: UUID;
  trigger_stamp_count: number;
  status: SpinStatus;
  /** `null` mientras está `PENDING`. */
  reward_type: RouletteReward | null;
  spun_at: IsoDateTime | null;
  /** Momento de `CONSUMED` / `CLAIMED`. */
  resolved_at: IsoDateTime | null;
}

/** Pesos de la ruleta: enteros ≥ 0 que suman 100. */
export type RouletteWeights = Record<RouletteReward, number>;

/** `gamification_config`: solo se descarga; si no hay fila se usan los valores por defecto. */
export interface GamificationConfig {
  evento_id: UUID;
  /** ≥ 1; por defecto 3. */
  spin_every_n_stamps: number;
  roulette_weights: RouletteWeights;
}

export const DEFAULT_SPIN_EVERY_N_STAMPS = 3;

export const DEFAULT_ROULETTE_WEIGHTS: Readonly<RouletteWeights> = Object.freeze({
  XP_200: 40,
  MULTIPLIER_1_5: 30,
  RAFFLE_TICKET: 20,
  PHYSICAL_PRIZE: 10,
});

export function defaultGamificationConfig(eventoId: UUID): GamificationConfig {
  return {
    evento_id: eventoId,
    spin_every_n_stamps: DEFAULT_SPIN_EVERY_N_STAMPS,
    roulette_weights: { ...DEFAULT_ROULETTE_WEIGHTS },
  };
}
