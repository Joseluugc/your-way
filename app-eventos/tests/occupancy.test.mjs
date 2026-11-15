import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateZoneOccupancy } from '../src/domain/map/calculateZoneOccupancy.ts';

const zone = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Auditorio',
  max_capacity: 100,
  current_capacity: 0,
  required_role: 'ATTENDEE',
};

function entries(count, zoneId = zone.id) {
  return Array.from({ length: count }, (_, index) => ({
    id: `log-${String(index).padStart(3, '0')}`,
    user_id: null,
    zone_id: zoneId,
    action: 'ENTRY',
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  }));
}

test('uses the exact 70% and 95% traffic-light thresholds', () => {
  assert.equal(calculateZoneOccupancy(zone, entries(69)).level, 'available');
  assert.equal(calculateZoneOccupancy(zone, entries(70)).level, 'medium');
  assert.equal(calculateZoneOccupancy(zone, entries(94)).level, 'medium');
  assert.equal(calculateZoneOccupancy(zone, entries(95)).level, 'full');
});

test('counts only this zone and applies entries/exits in timestamp order', () => {
  const logs = [
    ...entries(2),
    {
      id: 'later-exit',
      user_id: null,
      zone_id: zone.id,
      action: 'EXIT',
      timestamp: '2026-01-01T00:03:00.000Z',
    },
    {
      id: 'other-zone-entry',
      user_id: null,
      zone_id: 'another-zone',
      action: 'ENTRY',
      timestamp: '2026-01-01T00:04:00.000Z',
    },
  ];

  assert.equal(calculateZoneOccupancy(zone, logs).current_capacity, 1);
});

test('never returns negative occupancy and marks invalid maximum capacity unavailable', () => {
  const exit = {
    id: 'exit',
    user_id: null,
    zone_id: zone.id,
    action: 'EXIT',
    timestamp: '2026-01-01T00:00:00.000Z',
  };
  const empty = calculateZoneOccupancy(zone, [exit]);
  assert.equal(empty.current_capacity, 0);

  const invalid = calculateZoneOccupancy({ ...zone, max_capacity: 0 }, entries(1));
  assert.equal(invalid.occupancy_percentage, null);
  assert.equal(invalid.level, 'unavailable');
});
