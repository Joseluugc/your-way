import { initializeAppDatabase } from '../../src/database/initializeDatabase';
import { createTempDatabase } from './sqliteHarness';

/**
 * BD de prueba inicializada como la app (migraciones + plano de ejemplo), sin el seed de
 * desarrollo. Contiene 2 eventos, 4 estands y 5 salas con aforos en los umbrales del semáforo.
 */
export async function createAppDatabase() {
  const temp = createTempDatabase();
  const globals = globalThis as { __DEV__?: boolean };
  const wasDev = globals.__DEV__;
  globals.__DEV__ = false;
  try {
    await initializeAppDatabase(temp.database);
  } finally {
    globals.__DEV__ = wasDev;
  }
  return temp;
}
