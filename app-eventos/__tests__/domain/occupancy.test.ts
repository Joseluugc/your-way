import { describe, expect, it } from '@jest/globals';
import { calculateZoneOccupancy } from '../../src/domain/map/calculateZoneOccupancy';
import type { AccessLog, Zone } from '../../src/domain/map/mapTypes';
import { getOccupancyStatus, OCCUPANCY_STATUS } from '../../src/domain/map/occupancyStatus';

const ZONE: Zone = {
  id: 'zona-1000',
  name: 'Pabellón',
  max_capacity: 1000,
  current_capacity: 0,
  required_role: 'ATTENDEE',
};

let nextLog = 0;
function log(action: 'ENTRY' | 'EXIT', minute: number, zoneId = ZONE.id): AccessLog {
  nextLog += 1;
  return {
    id: `log-${nextLog}`,
    user_id: null,
    zone_id: zoneId,
    action,
    timestamp: new Date(Date.UTC(2026, 10, 15, 10, 0, minute)).toISOString(),
  };
}

const entries = (count: number) => Array.from({ length: count }, (_, index) => log('ENTRY', index));

describe('[US-03.2] aforo en tiempo real (calculateZoneOccupancy)', () => {
  it.each([
    [699, 69.9, 'available'],
    [700, 70, 'medium'],
    [949, 94.9, 'medium'],
    [950, 95, 'full'],
    [1000, 100, 'full'],
  ] as const)(
    '[US-03.2] con %i entradas la zona está al %d %% y en nivel %s',
    (count, percentage, level) => {
      const occupancy = calculateZoneOccupancy(ZONE, entries(count));
      expect(occupancy.current_capacity).toBe(count);
      expect(occupancy.occupancy_percentage).toBeCloseTo(percentage, 5);
      expect(occupancy.level).toBe(level);
    },
  );

  it('[US-03.2] marca la zona como llena al 95 %', () => {
    expect(calculateZoneOccupancy(ZONE, entries(950)).level).toBe('full');
  });

  it('[US-03.2] una zona sin capacidad máxima válida queda unavailable', () => {
    for (const maxCapacity of [0, -5, 12.5]) {
      const occupancy = calculateZoneOccupancy({ ...ZONE, max_capacity: maxCapacity }, entries(3));
      expect(occupancy.level).toBe('unavailable');
      expect(occupancy.occupancy_percentage).toBeNull();
    }
  });

  it('[US-03.2] un log con acción desconocida deja la zona unavailable', () => {
    const invalid = { ...log('ENTRY', 1), action: 'JUMP' } as unknown as AccessLog;
    expect(calculateZoneOccupancy(ZONE, [...entries(2), invalid]).level).toBe('unavailable');
  });

  it('[US-03.2] con más salidas que entradas el aforo no baja de 0', () => {
    const logs = [log('ENTRY', 0), log('ENTRY', 1), log('EXIT', 2), log('EXIT', 3), log('EXIT', 4)];
    const occupancy = calculateZoneOccupancy(ZONE, logs);
    expect(occupancy.current_capacity).toBe(0);
    expect(occupancy.occupancy_percentage).toBe(0);
    expect(occupancy.level).toBe('available');
  });

  it('[US-03.2] tras vaciarse, las nuevas entradas cuentan desde 0', () => {
    const logs = [log('EXIT', 0), log('EXIT', 1), log('ENTRY', 2), log('ENTRY', 3)];
    expect(calculateZoneOccupancy(ZONE, logs).current_capacity).toBe(2);
  });

  it('[US-03.2] aplica los logs en orden cronológico aunque lleguen desordenados', () => {
    const exit = log('EXIT', 30);
    const entry = log('ENTRY', 10);
    expect(calculateZoneOccupancy(ZONE, [exit, entry]).current_capacity).toBe(0);
  });

  it('[US-03.2] ignora logs repetidos y de otras zonas', () => {
    const entry = log('ENTRY', 0);
    const otherZone = log('ENTRY', 1, 'otra-zona');
    expect(calculateZoneOccupancy(ZONE, [entry, entry, otherZone]).current_capacity).toBe(1);
  });

  it('[US-03.2] acepta marcas de tiempo de SQLite ("YYYY-MM-DD HH:MM:SS")', () => {
    const logs: AccessLog[] = [
      { ...log('ENTRY', 0), timestamp: '2026-11-15 10:00:00' },
      { ...log('EXIT', 0), timestamp: '2026-11-15 10:05:00' },
    ];
    expect(calculateZoneOccupancy(ZONE, logs).current_capacity).toBe(0);
  });
});

describe('[US-03.2] presentación del semáforo', () => {
  it('[US-03.2] cada nivel tiene texto, icono y color propios', () => {
    const statuses = Object.values(OCCUPANCY_STATUS);
    expect(new Set(statuses.map((status) => status.label)).size).toBe(4);
    expect(new Set(statuses.map((status) => status.icon)).size).toBe(4);
    expect(new Set(statuses.map((status) => status.color)).size).toBe(4);
  });

  it('[US-03.2] getOccupancyStatus devuelve el estado del nivel', () => {
    expect(getOccupancyStatus('full')).toEqual({ label: 'Completo', icon: '✕', color: '#C0392B' });
  });
});
