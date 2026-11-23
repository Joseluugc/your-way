import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptIncomingEventNotification,
  createDemoEventNotification,
  filterAndSortEventNotifications,
  getRelatedZoneName,
} from '../src/domain/notifications/eventNotification.ts';

const notification = (id, type, received_at, related_zone_id = null) => ({
  id,
  type,
  title: id,
  content: `Contenido ${id}`,
  related_zone_id,
  received_at,
  is_read: false,
});

test('filters by type and sorts newest notifications first without mutating input', () => {
  const saved = [
    notification(
      '00000000-0000-4000-8000-000000000001',
      'ORGANIZATION_NOTICE',
      '2026-11-19T10:00:00.000Z',
    ),
    notification(
      '00000000-0000-4000-8000-000000000002',
      'CAPACITY_ALERT',
      '2026-11-19T12:00:00.000Z',
    ),
    notification(
      '00000000-0000-4000-8000-000000000003',
      'CAPACITY_ALERT',
      '2026-11-19T11:00:00.000Z',
    ),
  ];

  const filtered = filterAndSortEventNotifications(saved, 'CAPACITY_ALERT');
  assert.deepEqual(
    filtered.map((item) => item.id),
    [
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
    ],
  );
  assert.equal(saved[0].id, '00000000-0000-4000-8000-000000000001');
});

test('resolves a notification zone id to its current zone name', () => {
  const zoneId = '550e8400-e29b-41d4-a716-446655440011';
  const alert = notification(
    '00000000-0000-4000-8000-000000000001',
    'SCHEDULE_CHANGE',
    '2026-11-19T10:00:00.000Z',
    zoneId,
  );

  assert.equal(
    getRelatedZoneName(alert, [{ id: zoneId, name: 'Auditorio Principal' }]),
    'Auditorio Principal',
  );
  assert.equal(getRelatedZoneName(alert, []), null);
});

test('does not create or accept simulated/server notifications while offline', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const receivedAt = '2026-11-19T10:00:00.000Z';
  const payload = notification(id, 'ORGANIZATION_NOTICE', receivedAt);

  assert.equal(createDemoEventNotification('ORGANIZATION_NOTICE', { id, received_at: receivedAt }, false), null);
  assert.equal(acceptIncomingEventNotification(payload, false), null);
  assert.equal(
    createDemoEventNotification('ORGANIZATION_NOTICE', { id, received_at: receivedAt }, true)?.is_read,
    false,
  );
});
