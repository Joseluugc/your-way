export type UUID = string;

export type UserRole = 'ATTENDEE' | 'VIP' | 'STAFF' | 'EXHIBITOR';
export type StandSyncStatus = 'PENDING' | 'SYNCED';

export interface Stand {
  id: UUID;
  name: string;
  owner_id: UUID | null;
  map_x: number;
  map_y: number;
  evento_id: UUID;
  sync_status: StandSyncStatus;
}

export interface Zone {
  id: UUID;
  name: string;
  max_capacity: number;
  current_capacity: number | null;
  required_role: UserRole | null;
}

export type AccessAction = 'ENTRY' | 'EXIT';

export interface AccessLog {
  id: UUID;
  user_id: UUID | null;
  zone_id: UUID | null;
  action: AccessAction;
  timestamp: string | null;
}

export type OccupancyLevel = 'available' | 'medium' | 'full' | 'unavailable';

export interface ZoneOccupancy {
  zone: Zone;
  current_capacity: number;
  occupancy_percentage: number | null;
  level: OccupancyLevel;
}

export interface MapSnapshot {
  stands: Stand[];
  zones: ZoneOccupancy[];
  last_synced_at: string | null;
}

export interface MapCoordinates {
  map_x: number;
  map_y: number;
}
