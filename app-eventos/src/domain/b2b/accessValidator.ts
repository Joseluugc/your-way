// app-eventos/src/domain/b2b/accessValidator.ts
import type { UserRole } from '../map/mapTypes';

const ROLE_LEVEL: Record<UserRole, number> = {
  ATTENDEE: 1,  // Asistente normal (solo zonas públicas)
  EXHIBITOR: 2, // Expositor (zonas públicas + zona de estands)
  VIP: 3,       // Invitado VIP
  STAFF: 4,     // Organización (acceso total)
};

/**
 * Valida si un usuario puede entrar en una zona.
 * Una zona sin rol requerido (null) se considera pública.
 * Un rol desconocido se deniega siempre.
 */
export function validateZoneAccess(
  userRole: UserRole,
  requiredZoneRole: UserRole | null,
): boolean {
  const userLevel = ROLE_LEVEL[userRole];
  const requiredLevel = requiredZoneRole === null ? ROLE_LEVEL.ATTENDEE : ROLE_LEVEL[requiredZoneRole];

  if (userLevel === undefined || requiredLevel === undefined) {
    return false;
  }
  return userLevel >= requiredLevel;
}