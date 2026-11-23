import assert from 'node:assert/strict';
import test from 'node:test';
import { validateZoneAccess } from '../src/domain/b2b/accessValidator.ts';

const ROLES = ['ATTENDEE', 'EXHIBITOR', 'VIP', 'STAFF'];

for (const [userIndex, userRole] of ROLES.entries()) {
  for (const [zoneIndex, requiredRole] of ROLES.entries()) {
    const expected = userIndex >= zoneIndex;
    test(`${userRole} en zona ${requiredRole} -> ${expected ? 'permitido' : 'denegado'}`, () => {
      assert.equal(validateZoneAccess(userRole, requiredRole), expected);
    });
  }
}