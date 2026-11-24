import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Abre una BD `node:sqlite` y la envuelve con el subconjunto de la API de
 * `expo-sqlite` que usan los repositorios (`execAsync`, `getFirstAsync`…).
 */
export function openDatabase(path) {
  const sqlite = new DatabaseSync(path);
  return {
    sqlite,
    database: {
      execAsync: async (sql) => sqlite.exec(sql),
      getFirstAsync: async (sql, ...parameters) =>
        sqlite.prepare(sql).get(...parameters) ?? null,
      getAllAsync: async (sql, ...parameters) =>
        sqlite.prepare(sql).all(...parameters),
      runAsync: async (sql, ...parameters) => sqlite.prepare(sql).run(...parameters),
      withTransactionAsync: async (operation) => {
        sqlite.exec('BEGIN');
        try {
          await operation();
          sqlite.exec('COMMIT');
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      },
    },
  };
}

/**
 * Crea una BD vacía en un directorio temporal. `cleanup()` la cierra y borra el
 * directorio (también los ficheros `-wal`/`-shm` de SQLite).
 */
export function createTempDatabase(prefix = 'your-way-') {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  const path = join(directory, 'test.sqlite');
  const opened = openDatabase(path);
  return {
    ...opened,
    path,
    directory,
    cleanup: () => {
      try {
        opened.sqlite.close();
      } catch {
        // Ya estaba cerrada (p. ej. el test la reabrió).
      }
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
