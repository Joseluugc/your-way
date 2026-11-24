/// <reference types="node" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

type Params = SQLInputValue[] | [Record<string, SQLInputValue>];

/**
 * Versión para Jest de `tests/sqliteHarness.mjs`: una BD `node:sqlite` en un directorio
 * temporal, envuelta con el subconjunto de la API de `expo-sqlite` que usan los repositorios.
 */
export function createTempDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'your-way-jest-'));
  const sqlite = new DatabaseSync(join(directory, 'test.sqlite'));
  const run = (sql: string, params: Params) => sqlite.prepare(sql).run(...(params as SQLInputValue[]));

  const database = {
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
    getFirstAsync: async (sql: string, ...params: Params) =>
      sqlite.prepare(sql).get(...(params as SQLInputValue[])) ?? null,
    getAllAsync: async (sql: string, ...params: Params) =>
      sqlite.prepare(sql).all(...(params as SQLInputValue[])),
    runAsync: async (sql: string, ...params: Params) => run(sql, params),
    withTransactionAsync: async (operation: () => Promise<void>) => {
      sqlite.exec('BEGIN');
      try {
        await operation();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;

  return {
    database,
    sqlite,
    cleanup: () => {
      sqlite.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

/** `node:sqlite` devuelve objetos sin prototipo: se copian para compararlos con `toEqual`. */
export function plain<T extends object>(rows: readonly T[]): T[] {
  return rows.map((row) => ({ ...row }));
}
