import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FakeClock,
  InMemoryRemote,
  RecordingEventBus,
  SeededRandom,
  SequentialIds,
} from './gamificationFakes.mjs';

const EVENTO_ID = '00000000-0000-4000-8000-000000000001';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stamp(overrides = {}) {
  return {
    id: 'stamp-1',
    user_id: '850e8400-e29b-41d4-a716-000000000001',
    stand_id: '550e8400-e29b-41d4-a716-446655440001',
    evento_id: EVENTO_ID,
    scanned_at: '2026-11-15T10:05:00.000Z',
    zone_level_at_scan: 'available',
    applied_multiplier: 2,
    trivia_result: 'PENDING',
    trivia_answered_at: null,
    ...overrides,
  };
}

test('los dobles de test son deterministas', () => {
  const clock = new FakeClock('2026-11-15T10:00:00.000Z');
  clock.advance(15_000);
  assert.equal(clock.now().toISOString(), '2026-11-15T10:00:15.000Z');

  const a = new SeededRandom(42);
  const b = new SeededRandom(42);
  const values = Array.from({ length: 100 }, () => a.next());
  assert.deepEqual(values, Array.from({ length: 100 }, () => b.next()));
  assert.ok(values.every((value) => value >= 0 && value < 1));

  const ids = new SequentialIds();
  const first = ids.uuid();
  assert.match(first, UUID_V4);
  assert.notEqual(first, ids.uuid());

  const bus = new RecordingEventBus();
  const received = [];
  bus.subscribe('Ping', (payload) => received.push(payload));
  bus.publish('Ping', { n: 1 });
  assert.deepEqual(received, [{ n: 1 }]);
  assert.deepEqual(bus.payloadsOf('Ping'), [{ n: 1 }]);
});

test('InMemoryRemote ignora duplicados por clave natural y simula fallos', async () => {
  const remote = new InMemoryRemote();
  const row = { id: 'xp-1', source_type: 'STAMP', reference_id: 'stamp-1', final_xp: 100 };
  await remote.uploadXpTransactions([row]);
  await remote.uploadXpTransactions([row, { ...row, id: 'xp-2' }]);
  assert.equal(remote.rows('xp_transactions').length, 1);

  await assert.rejects(remote.uploadXpTransactions([{ ...row, synced: 0 }]), /synced/);

  remote.failOn('uploadUserStamps');
  await assert.rejects(remote.uploadUserStamps([]), /Fallo simulado/);
  await remote.uploadUserStamps([]);

  await remote.uploadUserStamps([stamp()]);
  await remote.updateStampTrivia([{ id: 'stamp-1', trivia_result: 'CORRECT', trivia_answered_at: 'x' }]);
  await remote.updateStampTrivia([{ id: 'stamp-1', trivia_result: 'WRONG', trivia_answered_at: 'y' }]);
  assert.equal(remote.rows('user_stamps')[0].trivia_result, 'CORRECT');

  const offline = new InMemoryRemote({ connected: false });
  await assert.rejects(offline.downloadFactions(EVENTO_ID), /Sin conexión/);
});
