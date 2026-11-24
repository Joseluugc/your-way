import type {
  ClockPort,
  EventBusPort,
  GamificationRepositoryPort,
  IdGeneratorPort,
  RandomPort,
} from './ports.ts';

/** Dependencias que el módulo necesita; las construye la capa de composición (provider). */
export interface GamificationModuleDeps {
  bus: EventBusPort;
  repository: GamificationRepositoryPort;
  clock: ClockPort;
  random: RandomPort;
  ids: IdGeneratorPort;
}

/** Desuscribe todos los handlers que registró el módulo. Idempotente. */
export type UnregisterGamificationModule = () => void;

/**
 * Suscribe los casos de uso del módulo a los eventos de entrada del bus.
 * De momento solo guarda las dependencias: cada historia (US1…US5) añade aquí sus
 * suscripciones (`StandNfcScanned`, `AttendeeWristbandWritten`, `ZoneOccupancyChanged`).
 */
export function registerGamificationModule(
  deps: GamificationModuleDeps,
): UnregisterGamificationModule {
  const subscriptions: (() => void)[] = [];
  // Las suscripciones de cada historia usarán `deps` (p. ej. deps.bus.subscribe(...)).
  void deps;

  return () => {
    while (subscriptions.length > 0) {
      subscriptions.pop()?.();
    }
  };
}
