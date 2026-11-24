import type { SQLiteDatabase } from 'expo-sqlite';
import type { NfcScanRecord, NfcTagRepositoryPort } from '../domain/nfc/scanTag.ts';
import type { NfcTagRow } from '../domain/nfc/nfcTag.ts';

/** Usuario que todavía no tiene pulsera vinculada (para la prueba de concepto). */
export interface UserWithoutWristband {
  id: string;
  name: string;
}

interface ScanRow {
  id: string;
  uid: string | null;
  uid_source: NfcScanRecord['uidSource'];
  tech_types: string;
  ndef_texts: string;
  resolution: NfcScanRecord['resolution'];
  duration_ms: number;
  scanned_at: string;
}

/**
 * Registro de lecturas de la prueba de concepto. Es solo local y de diagnóstico:
 * se crea aquí y no en `initializeDatabase.ts` para poder retirarlo sin dejar una
 * migración huérfana. Los cambios definitivos de `nfc_tags` irán como migración.
 */
const POC_SCHEMA = `
  CREATE TABLE IF NOT EXISTS nfc_poc_scans (
    id TEXT PRIMARY KEY NOT NULL,
    uid TEXT,
    uid_source TEXT CHECK (uid_source IS NULL OR uid_source IN ('HARDWARE', 'NDEF')),
    tech_types TEXT NOT NULL,
    ndef_texts TEXT NOT NULL,
    resolution TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    scanned_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_nfc_poc_scans_scanned_at ON nfc_poc_scans(scanned_at);
`;

function parseStringArray(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export class NfcTagRepository implements NfcTagRepositoryPort {
  private readonly database: SQLiteDatabase;
  private schemaReady: Promise<void> | null = null;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  ensureSchema(): Promise<void> {
    this.schemaReady ??= this.database.execAsync(POC_SCHEMA);
    return this.schemaReady;
  }

  async findTag(uid: string): Promise<NfcTagRow | null> {
    return this.database.getFirstAsync<NfcTagRow>(
      `SELECT uid, type, user_id, stand_id, zone_id FROM nfc_tags WHERE uid = ?`,
      uid,
    );
  }

  async recordScan(record: NfcScanRecord): Promise<void> {
    await this.ensureSchema();
    await this.database.runAsync(
      `INSERT INTO nfc_poc_scans (
         id, uid, uid_source, tech_types, ndef_texts, resolution, duration_ms, scanned_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.uid,
      record.uidSource,
      JSON.stringify(record.techTypes),
      JSON.stringify(record.ndefTexts),
      record.resolution,
      record.durationMs,
      record.scannedAt,
    );
  }

  async listRecentScans(limit = 20): Promise<NfcScanRecord[]> {
    await this.ensureSchema();
    const rows = await this.database.getAllAsync<ScanRow>(
      `SELECT * FROM nfc_poc_scans ORDER BY scanned_at DESC, id DESC LIMIT ?`,
      limit,
    );
    return rows.map((row) => ({
      id: row.id,
      uid: row.uid,
      uidSource: row.uid_source,
      techTypes: parseStringArray(row.tech_types),
      ndefTexts: parseStringArray(row.ndef_texts),
      resolution: row.resolution,
      durationMs: row.duration_ms,
      scannedAt: row.scanned_at,
    }));
  }

  async listUsersWithoutWristband(): Promise<UserWithoutWristband[]> {
    return this.database.getAllAsync<UserWithoutWristband>(
      `SELECT u.id, u.name FROM users AS u
       WHERE NOT EXISTS (
         SELECT 1 FROM nfc_tags AS t WHERE t.user_id = u.id AND t.type = 'USER_WRISTBAND'
       )
       ORDER BY u.name`,
    );
  }

  /**
   * Vincula un tag físico a un usuario como pulsera de prueba. Solo para la
   * prueba de concepto: la vinculación real (grabación NDEF, verificación y
   * sincronización) es la US-02.3.
   */
  async linkTestWristband(uid: string, userId: string): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO nfc_tags (uid, type, user_id, stand_id, zone_id)
       VALUES (?, 'USER_WRISTBAND', ?, NULL, NULL)`,
      uid,
      userId,
    );
  }
}
