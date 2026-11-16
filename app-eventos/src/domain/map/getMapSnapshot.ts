import { calculateZoneOccupancy } from './calculateZoneOccupancy';
import type { AccessLog, MapSnapshot, Stand, Zone } from './mapTypes';

export interface MapRepositoryPort {
  getStands(): Promise<Stand[]>;
  getZones(): Promise<Zone[]>;
  getAccessLogs(): Promise<AccessLog[]>;
  getLastSyncedAt(): Promise<string | null>;
}

export async function getMapSnapshot(repository: MapRepositoryPort): Promise<MapSnapshot> {
  const [stands, zones, accessLogs, lastSyncedAt] = await Promise.all([
    repository.getStands(),
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
