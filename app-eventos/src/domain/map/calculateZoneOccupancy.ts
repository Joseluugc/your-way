import type { AccessLog, OccupancyLevel, Zone, ZoneOccupancy } from './mapTypes';

export function calculateZoneOccupancy(zone: Zone, logs: AccessLog[]): ZoneOccupancy {
  const zoneLogs = logs
    .filter((log) => log.zone_id === zone.id)
    .slice()
    .sort((first, second) => {
      const timestampOrder = (first.timestamp ?? '').localeCompare(second.timestamp ?? '');
      return timestampOrder || first.id.localeCompare(second.id);
    });

  const currentCapacity = zoneLogs.reduce((capacity, log) => {
    if (log.action === 'ENTRY') {
      return capacity + 1;
    }

    return Math.max(0, capacity - 1);
  }, 0);

  if (!Number.isInteger(zone.max_capacity) || zone.max_capacity <= 0) {
    return {
      zone,
      current_capacity: currentCapacity,
      occupancy_percentage: null,
      level: 'unavailable',
    };
  }

  const occupancyPercentage = (currentCapacity / zone.max_capacity) * 100;
  const level: OccupancyLevel =
    occupancyPercentage >= 95
      ? 'full'
      : occupancyPercentage >= 70
        ? 'medium'
        : 'available';

  return {
    zone,
    current_capacity: currentCapacity,
    occupancy_percentage: occupancyPercentage,
    level,
  };
}
