/**
 * Libro mayor de XP (research.md R7): los puntos nunca se guardan en contadores mutables;
 * cada ganancia es una `XpTransaction` inmutable y el total es la suma de `final_xp`.
 */
import type { AchievementCode, IsoDateTime, UUID, XpSource, XpTransaction } from './types.ts';

export const BASE_XP = Object.freeze({
  STAMP: 100,
  TRIVIA: 50,
  RATING: 25,
  ROULETTE_XP: 200,
});

export const ACHIEVEMENT_XP: Readonly<Record<AchievementCode, number>> = Object.freeze({
  EARLY_BIRD: 150,
  EXPERT_CRITIC: 200,
  SECTOR_EXPLORER: 300,
  SPEEDRUNNER: 250,
});

/** Orígenes a los que se aplica el multiplicador de zona y el personal (R11). */
const MULTIPLIABLE_SOURCES: ReadonlySet<XpSource> = new Set<XpSource>(['STAMP', 'TRIVIA']);

export function isMultipliableSource(source: XpSource): boolean {
  return MULTIPLIABLE_SOURCES.has(source);
}

export interface CreateXpTransactionInput {
  id: UUID;
  userId: UUID;
  factionId: UUID | null;
  eventoId: UUID;
  sourceType: XpSource;
  referenceId: UUID;
  baseXp: number;
  multiplier: number;
  createdAt: IsoDateTime;
}

export function createXpTransaction(input: CreateXpTransactionInput): XpTransaction {
  if (!Number.isInteger(input.baseXp) || input.baseXp <= 0) {
    throw new Error('Los puntos base de una transacción de XP deben ser un entero mayor que 0.');
  }
  if (!Number.isFinite(input.multiplier) || input.multiplier < 1) {
    throw new Error('El multiplicador de una transacción de XP debe ser mayor o igual que 1.');
  }

  // RATING, ACHIEVEMENT y ROULETTE nunca se multiplican.
  const multiplier = isMultipliableSource(input.sourceType) ? input.multiplier : 1;

  return {
    id: input.id,
    user_id: input.userId,
    faction_id: input.factionId,
    evento_id: input.eventoId,
    source_type: input.sourceType,
    reference_id: input.referenceId,
    base_xp: input.baseXp,
    multiplier,
    final_xp: Math.round(input.baseXp * multiplier),
    created_at: input.createdAt,
  };
}

/** Total de XP como suma del libro mayor. */
export function sumFinalXp(transactions: readonly Pick<XpTransaction, 'final_xp'>[]): number {
  return transactions.reduce((total, transaction) => total + transaction.final_xp, 0);
}
