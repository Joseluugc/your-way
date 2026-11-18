// app-eventos/src/domain/b2b/accessValidator.ts

export type UserRole = 'ATTENDEE' | 'EXHIBITOR' | 'VIP' | 'STAFF';
export type ZoneRole = 'ATTENDEE' | 'EXHIBITOR' | 'VIP' | 'STAFF';

/**
 * Valida si el rol de un usuario tiene permiso para entrar a una zona específica.
 * @param userRole El rol del asistente escaneado.
 * @param requiredZoneRole El rol mínimo exigido por la zona/puerta.
 * @returns boolean - true (Acceso Permitido) o false (Acceso Denegado)
 */
export function validateZoneAccess(userRole: UserRole, requiredZoneRole: ZoneRole): boolean {
  // Definimos la jerarquía de roles (mayor número = más permisos)
  const roleHierarchy: Record<UserRole, number> = {
    'ATTENDEE': 1,   // Asistente normal (solo zonas públicas)
    'EXHIBITOR': 2,  // Expositor (zonas públicas + zona de estands privada)
    'VIP': 3,        // Invitado VIP (casi todo)
    'STAFF': 4       // Organización (acceso total)
  };

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredZoneRole] || 0;

  // Si tu nivel es igual o superior al requerido, la puerta se abre (Verde)
  return userLevel >= requiredLevel;
}