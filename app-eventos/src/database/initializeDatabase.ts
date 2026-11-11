import type { SQLiteDatabase } from 'expo-sqlite';

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

    -- FORZAMOS EL BORRADO DE LA TABLA ANTIGUA PARA ACTUALIZAR COLUMNAS
    DROP TABLE IF EXISTS eventos;

    -- NUEVA TABLA DE EVENTOS
    CREATE TABLE IF NOT EXISTS eventos (
      id TEXT PRIMARY KEY NOT NULL,
      titulo TEXT NOT NULL,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      ubicacion TEXT NOT NULL,
      descripcion TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_stamps_stand_id ON stamps(stand_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_stand_id ON ratings(stand_id);
    CREATE INDEX IF NOT EXISTS idx_leads_scanned_at ON leads(scanned_at);
  `);
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

      INSERT OR IGNORE INTO zones (id, name, max_capacity, current_capacity, required_role) VALUES
        ('zone-auditorium', 'Auditorio Principal', 200, 45, 'ATTENDEE'),
        ('zone-vip', 'Zona VIP & Lounge', 50, 12, 'VIP');

      INSERT OR IGNORE INTO stands (id, name, owner_id, map_x, map_y) VALUES
        ('stand-tech', 'Tech Solutions', 'user-exhibitor-1', 10.5, 20.0),
        ('stand-ai', 'AI & Data Lab', 'user-exhibitor-1', 30.0, 45.0);

      INSERT OR IGNORE INTO nfc_tags (uid, type, user_id, stand_id, zone_id) VALUES
        ('tag-user-ana', 'USER_WRISTBAND', 'user-attendee-1', NULL, NULL),
        ('tag-stand-tech', 'STAND_POINT', NULL, 'stand-tech', NULL),
        ('tag-zone-auditorium', 'ZONE_CHECKPOINT', NULL, NULL, 'zone-auditorium');

      INSERT OR IGNORE INTO stamps (id, user_id, stand_id) VALUES
        ('stamp-1', 'user-attendee-1', 'stand-tech'),
        ('stamp-2', 'user-vip-1', 'stand-tech'),
        ('stamp-3', 'user-attendee-2', 'stand-ai');

      INSERT OR IGNORE INTO ratings (id, user_id, stand_id, score) VALUES
        ('rating-1', 'user-attendee-1', 'stand-tech', 5),
        ('rating-2', 'user-vip-1', 'stand-tech', 4),
        ('rating-3', 'user-attendee-2', 'stand-ai', 5);

      INSERT OR IGNORE INTO leads (id, scanner_user_id, scanned_user_id) VALUES
        ('lead-1', 'user-exhibitor-1', 'user-attendee-1'),
        ('lead-2', 'user-exhibitor-1', 'user-vip-1');

      INSERT OR IGNORE INTO access_logs (id, user_id, zone_id, action) VALUES
        ('access-1', 'user-attendee-1', 'zone-auditorium', 'ENTRY'),
        ('access-2', 'user-vip-1', 'zone-vip', 'ENTRY');

      -- DATOS DE PRUEBA ACTUALIZADOS PARA EVENTOS
      INSERT OR IGNORE INTO eventos (id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion) VALUES
        ('evento-1', 'Presentación Your Way', '2026-11-15T10:00:00.000Z', '2026-11-15T11:30:00.000Z', 'Auditorio Principal', 'Presentación oficial de la plataforma Your Way.'),
        ('evento-2', 'Taller de Networking', '2026-11-15T12:30:00.000Z', '2026-11-15T14:00:00.000Z', 'Zona VIP & Lounge', 'Sesión exclusiva de networking para expositores y VIPs.');
    `);
  });
}

export async function initializeAppDatabase(database: SQLiteDatabase): Promise<void> {
  await initializeDatabase(database);
  if (__DEV__) {
    await seedDevData(database);
  }
}