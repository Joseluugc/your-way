import type { SQLiteDatabase } from 'expo-sqlite';

export type UserRole = 'ATTENDEE' | 'VIP' | 'STAFF' | 'EXHIBITOR';

export interface RoleCount {
  role: UserRole;
  total: number;
}

export interface StandSummary {
  id: string;
  name: string;
  stampCount: number;
  averageRating: number | null;
  ratingCount: number;
}

export interface ZoneSummary {
  id: string;
  name: string;
  currentCapacity: number;
  maxCapacity: number;
}

export interface OrganizerDashboardStats {
  totalUsers: number;
  totalLeads: number;
  totalStamps: number;
  totalStands: number;
  usersByRole: RoleCount[];
  stands: StandSummary[];
  zones: ZoneSummary[];
}

interface RoleCountRow {
  role: UserRole;
  total: number;
}

interface StandSummaryRow {
  id: string;
  name: string;
  stamp_count: number;
  average_rating: number | null;
  rating_count: number;
}

interface ZoneSummaryRow {
  id: string;
  name: string;
  current_capacity: number | null;
  max_capacity: number;
}

interface CountRow {
  total: number;
}

const USER_ROLES: UserRole[] = ['ATTENDEE', 'VIP', 'STAFF', 'EXHIBITOR'];

export class OrganizerDashboardRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async getStats(): Promise<OrganizerDashboardStats> {
    const [roleRows, standRows, zoneRows, leadCount, stampCount] = await Promise.all([
      this.database.getAllAsync<RoleCountRow>(`
        SELECT role, COUNT(*) AS total
        FROM users
        GROUP BY role
      `),
      this.database.getAllAsync<StandSummaryRow>(`
        SELECT
          stands.id,
          stands.name,
          COALESCE(stamp_counts.total, 0) AS stamp_count,
          rating_counts.average_rating,
          COALESCE(rating_counts.total, 0) AS rating_count
        FROM stands
        LEFT JOIN (
          SELECT stand_id, COUNT(*) AS total
          FROM stamps
          WHERE stand_id IS NOT NULL
          GROUP BY stand_id
        ) AS stamp_counts ON stamp_counts.stand_id = stands.id
        LEFT JOIN (
          SELECT stand_id, AVG(score) AS average_rating, COUNT(score) AS total
          FROM ratings
          WHERE stand_id IS NOT NULL
          GROUP BY stand_id
        ) AS rating_counts ON rating_counts.stand_id = stands.id
        ORDER BY stands.name COLLATE NOCASE
      `),
      this.database.getAllAsync<ZoneSummaryRow>(`
        SELECT id, name, current_capacity, max_capacity
        FROM zones
        ORDER BY name COLLATE NOCASE
      `),
      this.database.getFirstAsync<CountRow>('SELECT COUNT(*) AS total FROM leads'),
      this.database.getFirstAsync<CountRow>('SELECT COUNT(*) AS total FROM stamps'),
    ]);

    const usersByRole = USER_ROLES.map((role) => ({
      role,
      total: roleRows.find((row) => row.role === role)?.total ?? 0,
    }));

    return {
      totalUsers: usersByRole.reduce((total, row) => total + row.total, 0),
      totalLeads: leadCount?.total ?? 0,
      totalStamps: stampCount?.total ?? 0,
      totalStands: standRows.length,
      usersByRole,
      stands: standRows.map((row) => ({
        id: row.id,
        name: row.name,
        stampCount: row.stamp_count,
        averageRating: row.average_rating,
        ratingCount: row.rating_count,
      })),
      zones: zoneRows.map((row) => ({
        id: row.id,
        name: row.name,
        currentCapacity: row.current_capacity ?? 0,
        maxCapacity: row.max_capacity,
      })),
    };
  }
}