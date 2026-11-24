import { describe, expect, it } from '@jest/globals';
import { validateZoneAccess, type UserRole } from '../../src/domain/b2b/accessValidator';

const ROLES: UserRole[] = ['ATTENDEE', 'EXHIBITOR', 'VIP', 'STAFF'];

/**
 * Matriz esperada [rol del usuario][rol requerido por la zona].
 * Jerarquía: ATTENDEE < EXHIBITOR < VIP < STAFF; se entra con un rol igual o superior.
 */
const EXPECTED: Record<UserRole, Record<UserRole, boolean>> = {
  ATTENDEE: { ATTENDEE: true, EXHIBITOR: false, VIP: false, STAFF: false },
  EXHIBITOR: { ATTENDEE: true, EXHIBITOR: true, VIP: false, STAFF: false },
  VIP: { ATTENDEE: true, EXHIBITOR: true, VIP: true, STAFF: false },
  STAFF: { ATTENDEE: true, EXHIBITOR: true, VIP: true, STAFF: true },
};

describe('[US-5.2] control de acceso por rol y zona', () => {
  describe.each(ROLES)('usuario %s', (userRole) => {
    it.each(ROLES)(`[US-5.2] ${userRole} en una zona que exige %s`, (zoneRole) => {
      expect(validateZoneAccess(userRole, zoneRole)).toBe(EXPECTED[userRole][zoneRole]);
    });

    it(`[US-5.2] ${userRole} entra en una zona sin required_role`, () => {
      expect(validateZoneAccess(userRole, null)).toBe(true);
    });
  });

  it('[US-5.2] cada rol entra en su propia zona (acceso permitido)', () => {
    for (const role of ROLES) {
      expect(validateZoneAccess(role, role)).toBe(true);
    }
  });

  it('[US-5.2] un rol insuficiente es rechazado (acceso denegado)', () => {
    expect(validateZoneAccess('ATTENDEE', 'VIP')).toBe(false);
    expect(validateZoneAccess('EXHIBITOR', 'VIP')).toBe(false);
    expect(validateZoneAccess('VIP', 'STAFF')).toBe(false);
  });

  it('[US-5.2] STAFF tiene acceso total', () => {
    expect(ROLES.every((zoneRole) => validateZoneAccess('STAFF', zoneRole))).toBe(true);
  });
});
