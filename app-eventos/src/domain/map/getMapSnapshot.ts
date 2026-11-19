import { calculateZoneOccupancy } from './calculateZoneOccupancy.ts';
import type { AccessLog, MapSnapshot, Stand, Zone } from './mapTypes';

export interface MapRepositoryPort {
  getStands(eventId?: string | null): Promise<Stand[]>;
  getZones(): Promise<Zone[]>;
  getAccessLogs(): Promise<AccessLog[]>;
  getLastSyncedAt(): Promise<string | null>;
}

export async function getMapSnapshot(
  repository: MapRepositoryPort,
  eventId?: string | null,
): Promise<MapSnapshot> {
  const [stands, zones, accessLogs, lastSyncedAt] = await Promise.all([
    repository.getStands(eventId),
    repository.getZones(),
    repository.getAccessLogs(),
    repository.getLastSyncedAt(),
  ]);

  return {
    stands,
    zones: zones.map((zone) => calculateZoneOccupancy(zone, accessLogs)),
    last_synced_at: lastSyncedAt,
  };
}
