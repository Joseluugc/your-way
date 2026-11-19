import type { AccessLog, OccupancyLevel, Zone, ZoneOccupancy } from './mapTypes';

// SQLite CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS", UTC) and ISO 8601 strings
// do not sort correctly as text, so compare parsed instants. Missing or invalid
// timestamps sort last.
function timestampValue(timestamp: string | null): number {
  if (!timestamp) {
    return Number.POSITIVE_INFINITY;
  }

  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(timestamp)
    ? `${timestamp.replace(' ', 'T')}Z`
    : timestamp;
  const value = Date.parse(normalized);
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

export function calculateZoneOccupancy(zone: Zone, logs: AccessLog[]): ZoneOccupancy {
  const seenLogIds = new Set<string>();
  const zoneLogs: AccessLog[] = [];
  let hasInvalidLogs = false;

  for (const log of logs) {
    if (log.zone_id !== zone.id) {
      continue;
    }
    if (
      typeof log.id !== 'string' ||
      log.id.length === 0 ||
      (log.action !== 'ENTRY' && log.action !== 'EXIT')
    ) {
      hasInvalidLogs = true;
      continue;
    }
    if (seenLogIds.has(log.id)) {
      continue;
    }

    seenLogIds.add(log.id);
    if (log.timestamp !== null && !Number.isFinite(timestampValue(log.timestamp))) {
      hasInvalidLogs = true;
    }
    zoneLogs.push(log);
  }

  zoneLogs.sort((first, second) => {
    const firstTime = timestampValue(first.timestamp);
    const secondTime = timestampValue(second.timestamp);
    if (firstTime !== secondTime) {
      return firstTime < secondTime ? -1 : 1;
    }
    return first.id < second.id ? -1 : first.id > second.id ? 1 : 0;
  });

  const currentCapacity = zoneLogs.reduce((capacity, log) => {
    if (log.action === 'ENTRY') {
      return capacity + 1;
    }

    return Math.max(0, capacity - 1);
  }, 0);

  if (
    typeof zone.max_capacity !== 'number' ||
    !Number.isInteger(zone.max_capacity) ||
    zone.max_capacity <= 0 ||
    hasInvalidLogs
  ) {
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
