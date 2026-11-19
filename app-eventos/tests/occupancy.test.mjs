import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateZoneOccupancy } from '../src/domain/map/calculateZoneOccupancy.ts';
import {
  MAP_MOCK_ACCESS_LOGS,
  MAP_MOCK_ZONES,
} from '../src/domain/map/mapMockData.ts';

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

test('mock access logs cover traffic-light boundaries and invalid capacity', () => {
  const occupancies = MAP_MOCK_ZONES.map((item) =>
    calculateZoneOccupancy(item, MAP_MOCK_ACCESS_LOGS),
  );
  assert.deepEqual(
    occupancies.map((item) => item.level),
    ['available', 'medium', 'medium', 'full', 'unavailable'],
  );
  assert.deepEqual(
    occupancies.slice(0, 4).map((item) => item.occupancy_percentage),
    [69, 70, 94, 95],
  );
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

  for (const max_capacity of [0, -1, null, undefined, Number.NaN]) {
    const invalid = calculateZoneOccupancy({ ...zone, max_capacity }, entries(1));
    assert.equal(invalid.occupancy_percentage, null);
    assert.equal(invalid.level, 'unavailable');
  }
});

test('deduplicates access logs by id without counting another zone', () => {
  const entry = {
    id: 'duplicate-entry',
    user_id: null,
    zone_id: zone.id,
    action: 'ENTRY',
    timestamp: '2026-01-01T00:00:00.000Z',
  };
  const duplicate = { ...entry };
  const otherZone = { ...entry, id: 'other-zone', zone_id: 'another-zone' };

  const result = calculateZoneOccupancy(zone, [entry, duplicate, otherZone]);
  assert.equal(result.current_capacity, 1);
  assert.equal(result.occupancy_percentage, 1);
});

test('marks malformed access log data as unavailable', () => {
  const invalidAction = {
    id: 'invalid-action',
    user_id: null,
    zone_id: zone.id,
    action: 'ENTER',
    timestamp: '2026-01-01T00:00:00.000Z',
  };
  const invalidTimestamp = {
    id: 'invalid-timestamp',
    user_id: null,
    zone_id: zone.id,
    action: 'ENTRY',
    timestamp: 'not-a-timestamp',
  };

  for (const log of [invalidAction, invalidTimestamp]) {
    const result = calculateZoneOccupancy(zone, [log]);
    assert.equal(result.occupancy_percentage, null);
    assert.equal(result.level, 'unavailable');
  }
});

test('orders SQLite and ISO timestamps by instant, not by text', () => {
  const log = (id, action, timestamp) => ({
    id,
    user_id: null,
    zone_id: zone.id,
    action,
    timestamp,
  });
  // Real order: ENTRY 09:30Z, EXIT 10:00Z, ENTRY 10:30Z. Text order would differ.
  const logs = [
    log('b', 'EXIT', '2026-01-01 10:00:00'),
    log('a', 'ENTRY', '2026-01-01T09:30:00.000Z'),
    log('c', 'ENTRY', '2026-01-01T10:30:00.000Z'),
  ];

  assert.equal(calculateZoneOccupancy(zone, logs).current_capacity, 1);
});

test('puts logs with missing timestamps last and keeps input unchanged', () => {
  const logs = [
    { id: 'x', user_id: null, zone_id: zone.id, action: 'EXIT', timestamp: null },
    { id: 'y', user_id: null, zone_id: zone.id, action: 'ENTRY', timestamp: '2026-01-01T00:00:00.000Z' },
  ];
  const snapshot = logs.map((entry) => entry.id);

  assert.equal(calculateZoneOccupancy(zone, logs).current_capacity, 0);
  assert.deepEqual(logs.map((entry) => entry.id), snapshot);
});
