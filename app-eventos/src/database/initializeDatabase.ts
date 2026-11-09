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

    CREATE INDEX IF NOT EXISTS idx_stamps_stand_id ON stamps(stand_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_stand_id ON ratings(stand_id);
    CREATE INDEX IF NOT EXISTS idx_leads_scanned_at ON leads(scanned_at);
  `);
}