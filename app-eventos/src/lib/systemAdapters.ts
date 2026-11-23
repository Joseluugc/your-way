import type { ClockPort, IdGeneratorPort, RandomPort } from '../domain/gamification/ports';
import { generateUuidV4 } from '../domain/map/manageStand';

/** Reloj del sistema. */
export const systemClock: ClockPort = {
  now: () => new Date(),
};

/** Aleatoriedad de `Math.random` (suficiente para la ruleta; no es criptográfica). */
export const mathRandom: RandomPort = {
  next: () => Math.random(),
};

/** UUID v4 con `crypto.randomUUID` y fallback (mismo generador que los estands). */
export const cryptoIds: IdGeneratorPort = {
  uuid: generateUuidV4,
};
