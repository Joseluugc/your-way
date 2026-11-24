/// <reference types="node" />
import { strict } from 'node:assert';
import { expect } from '@jest/globals';

// `node:assert/strict` está redirigido a este fichero (moduleNameMapper): se toma de `node:assert`.

/**
 * Sustituye a `node:assert/strict` cuando Jest ejecuta `tests/*.test.mjs`.
 *
 * Jest ejecuta cada fichero en un contexto aislado (vm), pero las filas que devuelve
 * `node:sqlite` se crean fuera de él: tienen otro `Array.prototype`/`Object.prototype`, y
 * `deepStrictEqual` las daría por distintas aunque el contenido sea idéntico. Aquí la
 * comparación profunda compara contenido (tipos primitivos estrictos, claves y valores) con
 * `expect().toEqual`; el resto de aserciones son las originales.
 */
function deepEqual(actual: unknown, expected: unknown, message?: string): void {
  try {
    expect(actual).toEqual(expected);
  } catch (error) {
    if (message) throw new strict.AssertionError({ message, actual, expected, operator: 'deepEqual' });
    throw error;
  }
}

// Los métodos de `assert` no son enumerables: se copian uno a uno.
const assert: Record<string, unknown> = {};
for (const key of Object.getOwnPropertyNames(strict)) {
  const value = (strict as unknown as Record<string, unknown>)[key];
  if (typeof value === 'function') assert[key] = value;
}
assert.deepEqual = deepEqual;
assert.deepStrictEqual = deepEqual;

export default assert as unknown as typeof strict;
