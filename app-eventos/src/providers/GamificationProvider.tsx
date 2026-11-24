import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { GamificationRepository } from '../database/GamificationRepository';
import { createEventBus } from '../domain/events/eventBus';
import type { GamificationEventMap } from '../domain/gamification/events';
import type { EventBusPort } from '../domain/gamification/ports';
import {
  registerGamificationModule,
  type GamificationModuleDeps,
} from '../domain/gamification/registerGamificationModule';
import { cryptoIds, mathRandom, systemClock } from '../lib/systemAdapters';

/** Casos de uso expuestos a la UI. Cada historia (US1…US5) añade los suyos. */
export type GamificationUseCases = Record<string, never>;

interface GamificationContextValue {
  bus: EventBusPort;
  useCases: GamificationUseCases;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

/**
 * Compone el módulo de Gamificación: crea el bus de eventos, el repositorio SQLite y los
 * adaptadores de sistema, y registra los handlers del módulo mientras está montado.
 * Debe montarse dentro de `SQLiteProvider`.
 */
export function GamificationProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();

  const deps = useMemo<GamificationModuleDeps>(
    () => ({
      bus: createEventBus<GamificationEventMap>(),
      repository: new GamificationRepository(database),
      clock: systemClock,
      random: mathRandom,
      ids: cryptoIds,
    }),
    [database],
  );

  useEffect(() => registerGamificationModule(deps), [deps]);

  const value = useMemo<GamificationContextValue>(
    () => ({ bus: deps.bus, useCases: {} }),
    [deps],
  );

  return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

export function useGamification(): GamificationContextValue {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification debe usarse dentro de GamificationProvider.');
  }
  return context;
}
