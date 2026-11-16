import type { SQLiteDatabase } from 'expo-sqlite';
import type { OrganizationAlert } from '../domain/notifications/organizationAlert';

export class AlertRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async getLatest(): Promise<OrganizationAlert[]> {
    return this.database.getAllAsync<OrganizationAlert>(`
      SELECT id, type, title, message, zone_id, created_at
      FROM cached_notifications
      ORDER BY created_at DESC, id DESC
    `);
  }

  async save(alert: OrganizationAlert): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO cached_notifications (id, type, title, message, zone_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type,
         title = excluded.title,
         message = excluded.message,
         zone_id = excluded.zone_id,
         created_at = excluded.created_at`,
      alert.id,
      alert.type,
      alert.title,
      alert.message,
      alert.zone_id,
      alert.created_at,
    );
  }
}
