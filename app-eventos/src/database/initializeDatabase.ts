import type { SQLiteDatabase } from 'expo-sqlite';
import {
  MAP_MOCK_ACCESS_LOGS,
  MAP_MOCK_STANDS,
  MAP_MOCK_ZONES,
  MAP_SEED_EVENTS,
} from '../domain/map/mapMockData.ts';

export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'ATTENDEE'
        CHECK (role IN ('ATTENDEE', 'VIP', 'STAFF', 'EXHIBITOR')),
      company TEXT,
      linkedin_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stands (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      map_x REAL NOT NULL,
      map_y REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS zones (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      max_capacity INTEGER NOT NULL,
      current_capacity INTEGER DEFAULT 0,
      required_role TEXT DEFAULT 'ATTENDEE'
        CHECK (required_role IS NULL OR required_role IN ('ATTENDEE', 'VIP', 'STAFF', 'EXHIBITOR'))
    );

    CREATE TABLE IF NOT EXISTS nfc_tags (
      uid TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('USER_WRISTBAND', 'STAND_POINT', 'ZONE_CHECKPOINT')),
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      stand_id TEXT REFERENCES stands(id) ON DELETE CASCADE,
      zone_id TEXT REFERENCES zones(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stamps (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      stand_id TEXT REFERENCES stands(id) ON DELETE CASCADE,
      scanned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_user_stand_stamp UNIQUE (user_id, stand_id)
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      stand_id TEXT REFERENCES stands(id) ON DELETE CASCADE,
      score INTEGER CHECK (score BETWEEN 1 AND 5),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY NOT NULL,
      scanner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      scanned_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      scanned_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS access_logs (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      zone_id TEXT REFERENCES zones(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK (action IN ('ENTRY', 'EXIT')),
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS eventos (
      id TEXT PRIMARY KEY NOT NULL,
      titulo TEXT NOT NULL,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      ubicacion TEXT NOT NULL,
      descripcion TEXT,
      CHECK (fecha_fin > fecha_inicio)
    );

    CREATE TABLE IF NOT EXISTS local_sync_state (
      scope TEXT PRIMARY KEY NOT NULL,
      last_synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_map_metadata (
      scope TEXT PRIMARY KEY NOT NULL,
      event_id TEXT REFERENCES eventos(id) ON DELETE SET NULL,
      coordinate_system TEXT NOT NULL
    );
    INSERT OR IGNORE INTO local_map_metadata (scope, event_id, coordinate_system)
      VALUES ('default', NULL, 'map-units-0-100');

    CREATE TABLE IF NOT EXISTS cached_notifications (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL
        CHECK (type IN ('ORGANIZATION', 'SCHEDULE_CHANGE', 'CAPACITY_OPEN', 'CAPACITY_CLOSE')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      zone_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stamps_stand_id ON stamps(stand_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_stand_id ON ratings(stand_id);
    CREATE INDEX IF NOT EXISTS idx_leads_scanned_at ON leads(scanned_at);
    CREATE INDEX IF NOT EXISTS idx_access_logs_zone_timestamp ON access_logs(zone_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_eventos_fecha_inicio ON eventos(fecha_inicio);
  `);
}

const SEED_EVENTO_1_ID = '00000000-0000-4000-8000-000000000001';
const SEED_EVENTO_2_ID = '00000000-0000-4000-8000-000000000002';
const SEED_STAND_ID = MAP_MOCK_STANDS[0].id;
const SEED_ZONE_ID = MAP_MOCK_ZONES[0].id;

/**
 * Migraciones versionadas con `PRAGMA user_version`: la posición en el array + 1 es la versión.
 * Nunca se edita una migración ya publicada; se añade una nueva al final.
 */
const MIGRATIONS: string[] = [
  // 1: columnas de sincronización de `eventos` (Spec 07). Las filas existentes quedan pendientes.
  `
    ALTER TABLE eventos ADD COLUMN updated_at TEXT;
    ALTER TABLE eventos ADD COLUMN deleted_at TEXT;
    ALTER TABLE eventos ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (sync_status IN ('pending', 'synced'));
    UPDATE eventos SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
    -- Los IDs del seed antiguo no son UUID válidos para Postgres.
    UPDATE eventos SET id = '${SEED_EVENTO_1_ID}' WHERE id = 'evento-1';
    UPDATE eventos SET id = '${SEED_EVENTO_2_ID}' WHERE id = 'evento-2';
  `,
  // 2: adapta la caché de avisos al contrato EventNotification conservando el histórico.
  `
    ALTER TABLE cached_notifications RENAME TO cached_notifications_legacy;

    CREATE TABLE cached_notifications (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL
        CHECK (type IN ('ORGANIZATION_NOTICE', 'SCHEDULE_CHANGE', 'CAPACITY_ALERT')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      related_zone_id TEXT REFERENCES zones(id) ON DELETE SET NULL,
      received_at TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1))
    );

    INSERT INTO cached_notifications (
      id, type, title, content, related_zone_id, received_at, is_read
    )
    SELECT
      legacy.id,
      CASE legacy.type
        WHEN 'ORGANIZATION' THEN 'ORGANIZATION_NOTICE'
        WHEN 'SCHEDULE_CHANGE' THEN 'SCHEDULE_CHANGE'
        WHEN 'CAPACITY_OPEN' THEN 'CAPACITY_ALERT'
        WHEN 'CAPACITY_CLOSE' THEN 'CAPACITY_ALERT'
      END,
      legacy.title,
      legacy.message,
      CASE
        WHEN EXISTS (SELECT 1 FROM zones WHERE zones.id = legacy.zone_id) THEN legacy.zone_id
        ELSE NULL
      END,
      legacy.created_at,
      0
    FROM cached_notifications_legacy AS legacy;

    DROP TABLE cached_notifications_legacy;
    CREATE INDEX idx_cached_notifications_received_at
      ON cached_notifications(received_at, id);
  `,
  // 3: asocia los estands existentes a un evento y crea su estado local de sincronización.
  `
    INSERT OR IGNORE INTO eventos (
      id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion, updated_at, sync_status
    ) VALUES
      ('${MAP_SEED_EVENTS[0].id}', '${MAP_SEED_EVENTS[0].titulo}', '${MAP_SEED_EVENTS[0].fecha_inicio}', '${MAP_SEED_EVENTS[0].fecha_fin}', '${MAP_SEED_EVENTS[0].ubicacion}', '${MAP_SEED_EVENTS[0].descripcion}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'pending'),
      ('${MAP_SEED_EVENTS[1].id}', '${MAP_SEED_EVENTS[1].titulo}', '${MAP_SEED_EVENTS[1].fecha_inicio}', '${MAP_SEED_EVENTS[1].fecha_fin}', '${MAP_SEED_EVENTS[1].ubicacion}', '${MAP_SEED_EVENTS[1].descripcion}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'pending');

    ALTER TABLE stands ADD COLUMN evento_id TEXT REFERENCES eventos(id) ON DELETE SET NULL;
    ALTER TABLE stands ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'SYNCED'
      CHECK (sync_status IN ('PENDING', 'SYNCED'));
    UPDATE stands
      SET evento_id = (
        SELECT id FROM eventos ORDER BY fecha_inicio, id LIMIT 1
      )
      WHERE evento_id IS NULL;
    CREATE INDEX idx_stands_evento_id ON stands(evento_id);
  `,
];

async function runMigrations(database: SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    await database.withTransactionAsync(async () => {
      await database.execAsync(MIGRATIONS[version]);
      await database.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

export async function seedBaseMapData(database: SQLiteDatabase): Promise<void> {
  const [standCount, zoneCount] = await Promise.all([
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM stands'),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM zones'),
  ]);
  if ((standCount?.count ?? 0) > 0 || (zoneCount?.count ?? 0) > 0) {
    return;
  }

  await database.withTransactionAsync(async () => {
    for (const event of MAP_SEED_EVENTS) {
      await database.runAsync(
        `INSERT OR IGNORE INTO eventos (
           id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion,
           updated_at, sync_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        event.id,
        event.titulo,
        event.fecha_inicio,
        event.fecha_fin,
        event.ubicacion,
        event.descripcion,
        new Date().toISOString(),
      );
    }

    for (const stand of MAP_MOCK_STANDS) {
      await database.runAsync(
        `INSERT OR IGNORE INTO stands (
           id, name, owner_id, map_x, map_y, evento_id, sync_status
         ) VALUES (?, ?, NULL, ?, ?, ?, 'SYNCED')`,
        stand.id,
        stand.name,
        stand.map_x,
        stand.map_y,
        stand.evento_id,
      );
    }

    for (const zone of MAP_MOCK_ZONES) {
      await database.runAsync(
        `INSERT OR IGNORE INTO zones (
           id, name, max_capacity, current_capacity, required_role
         ) VALUES (?, ?, ?, ?, ?)`,
        zone.id,
        zone.name,
        zone.max_capacity,
        zone.current_capacity,
        zone.required_role,
      );
    }

    for (const accessLog of MAP_MOCK_ACCESS_LOGS) {
      await database.runAsync(
        `INSERT OR IGNORE INTO access_logs (id, user_id, zone_id, action, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        accessLog.id,
        accessLog.user_id,
        accessLog.zone_id,
        accessLog.action,
        accessLog.timestamp,
      );
    }
  });
}

export async function seedDevData(database: SQLiteDatabase): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.execAsync(`
      INSERT OR IGNORE INTO users (id, name, email, role, company) VALUES
        ('user-attendee-1', 'Ana Gómez', 'ana@event.com', 'ATTENDEE', NULL),
        ('user-attendee-2', 'Luis Martín', 'luis@event.com', 'ATTENDEE', NULL),
        ('user-vip-1', 'María López', 'maria@event.com', 'VIP', NULL),
        ('user-staff-1', 'Organización Your Way', 'staff@event.com', 'STAFF', 'Your Way'),
        ('user-exhibitor-1', 'Carlos Ruiz', 'carlos@event.com', 'EXHIBITOR', 'Tech Solutions');

      INSERT OR IGNORE INTO nfc_tags (uid, type, user_id, stand_id, zone_id) VALUES
        ('tag-user-ana', 'USER_WRISTBAND', 'user-attendee-1', NULL, NULL),
        ('tag-stand-tech', 'STAND_POINT', NULL, '${SEED_STAND_ID}', NULL),
        ('tag-zone-auditorium', 'ZONE_CHECKPOINT', NULL, NULL, '${SEED_ZONE_ID}');

      INSERT OR IGNORE INTO stamps (id, user_id, stand_id) VALUES
        ('stamp-1', 'user-attendee-1', '${SEED_STAND_ID}'),
        ('stamp-2', 'user-vip-1', '${SEED_STAND_ID}'),
        ('stamp-3', 'user-attendee-2', '${MAP_MOCK_STANDS[1].id}');

      INSERT OR IGNORE INTO ratings (id, user_id, stand_id, score) VALUES
        ('rating-1', 'user-attendee-1', '${SEED_STAND_ID}', 5),
        ('rating-2', 'user-vip-1', '${SEED_STAND_ID}', 4),
        ('rating-3', 'user-attendee-2', '${MAP_MOCK_STANDS[1].id}', 5);

      INSERT OR IGNORE INTO leads (id, scanner_user_id, scanned_user_id) VALUES
        ('lead-1', 'user-exhibitor-1', 'user-attendee-1'),
        ('lead-2', 'user-exhibitor-1', 'user-vip-1');

      -- DATOS DE PRUEBA ACTUALIZADOS PARA EVENTOS
      INSERT OR IGNORE INTO eventos (id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion, updated_at) VALUES
        ('${SEED_EVENTO_1_ID}', 'Presentación Your Way', '2026-11-15T10:00:00.000Z', '2026-11-15T11:30:00.000Z', 'Auditorio Principal', 'Presentación oficial de la plataforma Your Way.', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ('${SEED_EVENTO_2_ID}', 'Taller de Networking', '2026-11-15T12:30:00.000Z', '2026-11-15T14:00:00.000Z', 'Zona VIP & Lounge', 'Sesión exclusiva de networking para expositores y VIPs.', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
    `);

  });
}

export async function initializeAppDatabase(database: SQLiteDatabase): Promise<void> {
  await initializeDatabase(database);
  await runMigrations(database);
  await seedBaseMapData(database);
  if (__DEV__) {
    await seedDevData(database);
  }
}