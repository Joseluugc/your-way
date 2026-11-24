import { expect, test as jestTest } from '@jest/globals';

/**
 * Sustituye a `node:test` cuando Jest ejecuta los tests de `tests/*.test.mjs`
 * (`moduleNameMapper` en package.json). Así la cobertura de Jest incluye esa suite sin
 * duplicarla, y `npm run test:domain` la sigue ejecutando con `node --test` sin cambios.
 *
 * Esos ficheros solo usan `test(nombre, fn)`. Para que el informe de Jest sea trazable,
 * a cada test se le antepone la Historia de Usuario de su fichero (si no la lleva ya).
 */
const STORY_BY_FILE: Record<string, string> = {
  'eventBus.test.mjs': '[US-04.1]',
  'eventNotification.test.mjs': '[US-03.3]',
  'eventosSync.test.mjs': '[US-07.2]',
  'gamificationFakes.test.mjs': '[US-04.1]',
  'gamificationFoundation.test.mjs': '[US-04.1]',
  'gamificationMigration.test.mjs': '[US-04.1]',
  // Gestión de estands por STAFF, plano normalizado y cola offline de estands.
  'mapManagement.test.mjs': '[US-03.4]',
  'mapOfflineSync.test.mjs': '[US-03.4]',
  'occupancy.test.mjs': '[US-03.2]',
};

export default function test(name: string, fn: () => unknown): void {
  const file = (expect.getState().testPath ?? '').split(/[\\/]/).pop() ?? '';
  const story = STORY_BY_FILE[file];
  const title = story && !name.startsWith('[US-') ? `${story} ${name}` : name;
  jestTest(title, async () => {
    await fn();
  });
}
