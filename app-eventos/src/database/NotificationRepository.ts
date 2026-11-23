import type { SQLiteDatabase } from 'expo-sqlite';
import type { EventNotification } from '../domain/notifications/eventNotification';

interface StoredEventNotification extends Omit<EventNotification, 'is_read'> {
  is_read: number;
}

export class NotificationRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async getLatest(): Promise<EventNotification[]> {
    const rows = await this.database.getAllAsync<StoredEventNotification>(`
      SELECT id, type, title, content, related_zone_id, received_at, is_read
      FROM cached_notifications
      ORDER BY received_at DESC, id DESC
    `);
    return rows.map((row) => ({ ...row, is_read: row.is_read === 1 }));
  }

  async save(notification: EventNotification): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO cached_notifications (
         id, type, title, content, related_zone_id, received_at, is_read
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type,
         title = excluded.title,
         content = excluded.content,
         related_zone_id = excluded.related_zone_id,
         received_at = excluded.received_at`,
      notification.id,
      notification.type,
      notification.title,
      notification.content,
      notification.related_zone_id ?? null,
      notification.received_at,
      notification.is_read ? 1 : 0,
    );
  }

  async markRead(id: string): Promise<void> {
    await this.database.runAsync(
      'UPDATE cached_notifications SET is_read = 1 WHERE id = ?',
      id,
    );
  }

  async markAllRead(): Promise<void> {
    await this.database.runAsync(
      'UPDATE cached_notifications SET is_read = 1 WHERE is_read = 0',
    );
  }
}
