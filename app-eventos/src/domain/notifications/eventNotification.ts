import type { UUID } from '../map/mapTypes';

export type EventNotificationType =
  | 'ORGANIZATION_NOTICE'
  | 'SCHEDULE_CHANGE'
  | 'CAPACITY_ALERT';

export type EventNotificationFilter = 'ALL' | EventNotificationType;

export interface EventNotification {
  id: UUID;
  type: EventNotificationType;
  title: string;
  content: string;
  related_zone_id?: UUID | null;
  received_at: string;
  is_read: boolean;
}

export interface DemoEventNotificationInput {
  id: UUID;
  received_at: string;
  related_zone_id?: UUID | null;
}

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isEventNotificationType(value: unknown): value is EventNotificationType {
  return (
    value === 'ORGANIZATION_NOTICE' ||
    value === 'SCHEDULE_CHANGE' ||
    value === 'CAPACITY_ALERT'
  );
}

export function parseEventNotification(value: unknown): EventNotification | null {
  if (!isRecord(value)) {
    return null;
  }

  const relatedZoneId = value.related_zone_id;
  if (
    typeof value.id !== 'string' ||
    !UUID_V4_PATTERN.test(value.id) ||
    !isEventNotificationType(value.type) ||
    typeof value.title !== 'string' ||
    value.title.trim().length === 0 ||
    typeof value.content !== 'string' ||
    value.content.trim().length === 0 ||
    typeof value.received_at !== 'string' ||
    !isIsoTimestamp(value.received_at) ||
    typeof value.is_read !== 'boolean' ||
    (relatedZoneId !== undefined &&
      relatedZoneId !== null &&
      (typeof relatedZoneId !== 'string' || relatedZoneId.trim().length === 0))
  ) {
    return null;
  }

  return {
    id: value.id,
    type: value.type,
    title: value.title,
    content: value.content,
    related_zone_id: relatedZoneId ?? null,
    received_at: value.received_at,
    is_read: value.is_read,
  };
}

export function acceptIncomingEventNotification(
  value: unknown,
  isOnline: boolean,
): EventNotification | null {
  return isOnline ? parseEventNotification(value) : null;
}

export function createDemoEventNotification(
  type: EventNotificationType,
  input: DemoEventNotificationInput,
  isOnline: boolean,
): EventNotification | null {
  if (
    !isOnline ||
    !UUID_V4_PATTERN.test(input.id) ||
    !isIsoTimestamp(input.received_at) ||
    (input.related_zone_id !== undefined &&
      input.related_zone_id !== null &&
      input.related_zone_id.trim().length === 0)
  ) {
    return null;
  }

  const content = demoNotificationContent(type);
  return {
    id: input.id,
    type,
    title: content.title,
    content: content.content,
    related_zone_id: type === 'ORGANIZATION_NOTICE' ? null : (input.related_zone_id ?? null),
    received_at: input.received_at,
    is_read: false,
  };
}

export function filterAndSortEventNotifications(
  notifications: readonly EventNotification[],
  filter: EventNotificationFilter = 'ALL',
): EventNotification[] {
  return notifications
    .filter((notification) => filter === 'ALL' || notification.type === filter)
    .slice()
    .sort((first, second) => {
      const timeDifference =
        timestampValue(second.received_at) - timestampValue(first.received_at);
      if (timeDifference !== 0) {
        return timeDifference;
      }
      return first.id < second.id ? 1 : first.id > second.id ? -1 : 0;
    });
}

export function getRelatedZoneName(
  notification: EventNotification,
  zones: readonly { id: UUID; name: string }[],
): string | null {
  if (!notification.related_zone_id) {
    return null;
  }
  return zones.find((zone) => zone.id === notification.related_zone_id)?.name ?? null;
}

function demoNotificationContent(
  type: EventNotificationType,
): { title: string; content: string } {
  switch (type) {
    case 'ORGANIZATION_NOTICE':
      return {
        title: 'Aviso de la organización',
        content: 'La organización ha publicado una comunicación para los asistentes.',
      };
    case 'SCHEDULE_CHANGE':
      return {
        title: 'Cambio de horario',
        content: 'Se ha actualizado el horario de una actividad de esta sala.',
      };
    case 'CAPACITY_ALERT':
      return {
        title: 'Aforo cerrado',
        content: 'Se ha cerrado temporalmente el acceso a esta sala por aforo.',
      };
  }
}

function isIsoTimestamp(value: string): boolean {
  return value.includes('T') && Number.isFinite(Date.parse(value));
}

function timestampValue(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
