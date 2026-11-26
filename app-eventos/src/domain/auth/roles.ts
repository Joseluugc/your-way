import type { Rol } from './authTypes';

/** Rutas de pestaña de `src/app/(tabs)/`. */
export type Pestana = 'index' | 'mapa' | 'puertas' | 'pasaporte' | 'escaner';

export function esStaff(rol: Rol): boolean {
  return rol === 'STAFF';
}

/**
 * Pestañas visibles para cada rol. Es solo UX: la autorización real la impone RLS.
 * STAFF: Resumen, Mapa y Puertas. ATTENDEE, VIP y EXHIBITOR: Pasaporte, Escáner y Mapa.
 */
export function pestanasPorRol(rol: Rol): readonly Pestana[] {
  return esStaff(rol) ? ['index', 'mapa', 'puertas'] : ['pasaporte', 'escaner', 'mapa'];
}
