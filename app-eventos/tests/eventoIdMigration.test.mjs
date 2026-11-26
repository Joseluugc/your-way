import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initializeAppDatabase,
  initializeDatabase,
  runMigrations,
} from '../src/database/initializeDatabase.ts';
import { createTempDatabase } from './sqliteHarness.mjs';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OLD_ID = '1794413030068';
const VALID_ID = 'e0000000-0000-4000-8000-000000000042';
const STAND_ID = '750e8400-e29b-41d4-a716-000000000099';

async function runInitialize(database) {
  const wasDev = globalThis.__DEV__;
  globalThis.__DEV__ = false;
  try {
    await initializeAppDatabase(database);
  } finally {
    globalThis.__DEV__ = wasDev;
  }
}

/** Base en versión 6 con un evento del formulario antiguo (id = Date.now()) y referencias a él. */
async function createVersion6Database() {
  const temp = createTempDatabase('your-way-evento-id-');
  await initializeDatabase(temp.database);
  await runMigrations(temp.database, 6);
  temp.sqlite.exec(`
    INSERT INTO eventos (id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion, updated_at, sync_status) VALUES
      ('${OLD_ID}', 'Evento antiguo', '2026-11-15T10:00:00.000Z', '2026-11-15T12:00:00.000Z', 'Sala 1', NULL, '2026-11-15T09:00:00.000Z', 'pending'),
      ('${VALID_ID}', 'Evento con UUID', '2026-11-16T10:00:00.000Z', '2026-11-16T12:00:00.000Z', 'Sala 2', 'ok', '2026-11-16T09:00:00.000Z', 'synced');
    INSERT INTO stands (id, name, owner_id, map_x, map_y, evento_id, sync_status)
      VALUES ('${STAND_ID}', 'Estand del evento antiguo', NULL, 10, 10, '${OLD_ID}', 'PENDING');
    UPDATE local_map_metadata SET event_id = '${OLD_ID}' WHERE scope = 'default';
    INSERT INTO gamification_config (evento_id) VALUES ('${OLD_ID}');
  `);
  return temp;
}

test('[US-07.1] un evento con id antiguo (Date.now) pasa a UUID v4 y queda pendiente de subir', async () => {
  const temp = await createVersion6Database();
  try {
    const before = temp.sqlite.prepare('SELECT COUNT(*) AS n FROM eventos').get().n;

    await runInitialize(temp.database);

    assert.ok(temp.sqlite.prepare('PRAGMA user_version').get().user_version >= 7);
    assert.equal(temp.sqlite.prepare('SELECT COUNT(*) AS n FROM eventos').get().n, before);
    assert.equal(temp.sqlite.prepare('SELECT COUNT(*) AS n FROM eventos WHERE id = ?').get(OLD_ID).n, 0);

    const migrated = temp.sqlite
      .prepare("SELECT id, titulo, ubicacion, sync_status FROM eventos WHERE titulo = 'Evento antiguo'")
      .get();
    assert.match(migrated.id, UUID_V4);
    assert.equal(migrated.ubicacion, 'Sala 1');
    assert.equal(migrated.sync_status, 'pending');
  } finally {
    temp.cleanup();
  }
});

test('[US-07.1] las tablas que apuntan al evento antiguo pasan a su nuevo id', async () => {
  const temp = await createVersion6Database();
  try {
    await runInitialize(temp.database);

    const { id } = temp.sqlite.prepare("SELECT id FROM eventos WHERE titulo = 'Evento antiguo'").get();
    assert.equal(temp.sqlite.prepare('SELECT evento_id FROM stands WHERE id = ?').get(STAND_ID).evento_id, id);
    assert.equal(
      temp.sqlite.prepare("SELECT event_id FROM local_map_metadata WHERE scope = 'default'").get().event_id,
      id,
    );
    assert.equal(temp.sqlite.prepare('SELECT COUNT(*) AS n FROM gamification_config WHERE evento_id = ?').get(id).n, 1);
  } finally {
    temp.cleanup();
  }
});

test('[US-07.1] un evento que ya tenía UUID no cambia', async () => {
  const temp = await createVersion6Database();
  try {
    await runInitialize(temp.database);

    const row = temp.sqlite.prepare('SELECT titulo, sync_status, updated_at FROM eventos WHERE id = ?').get(VALID_ID);
    assert.equal(row.titulo, 'Evento con UUID');
    assert.equal(row.sync_status, 'synced');
    assert.equal(row.updated_at, '2026-11-16T09:00:00.000Z');
  } finally {
    temp.cleanup();
  }
});

test('[US-07.1] tras la migración todos los eventos pendientes tienen un id que Supabase acepta', async () => {
  const temp = await createVersion6Database();
  try {
    await runInitialize(temp.database);

    // Misma consulta que `getPendingEventos` (lo que la cola sube a Supabase).
    const pending = temp.sqlite.prepare("SELECT id FROM eventos WHERE sync_status = 'pending'").all();
    assert.ok(pending.length > 0);
    for (const evento of pending) {
      assert.match(evento.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  } finally {
    temp.cleanup();
  }
});
