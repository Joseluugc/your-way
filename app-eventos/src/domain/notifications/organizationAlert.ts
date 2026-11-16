import type { UUID } from '../map/mapTypes';

export type OrganizationAlertType =
  | 'ORGANIZATION'
  | 'SCHEDULE_CHANGE'
  | 'CAPACITY_OPEN'
  | 'CAPACITY_CLOSE';

export interface OrganizationAlert {
  id: string;
  type: OrganizationAlertType;
  title: string;
  message: string;
  zone_id: UUID | null;
  created_at: string;
}

export function isOrganizationAlertType(value: unknown): value is OrganizationAlertType {
  return (
    value === 'ORGANIZATION' ||
    value === 'SCHEDULE_CHANGE' ||
    value === 'CAPACITY_OPEN' ||
    value === 'CAPACITY_CLOSE'
  );
}
