import type { UserRole } from '../map/mapTypes';

/** Rol de la tabla `users`. `STAFF` es el rol de organizador (Spec 08). */
export type Rol = UserRole;

export const ROLES: readonly Rol[] = ['ATTENDEE', 'VIP', 'STAFF', 'EXHIBITOR'];

/** Perfil del usuario con sesión, guardado en el dispositivo para arrancar sin red. */
export interface PerfilActivo {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export type TipoErrorAuth =
  | 'credenciales-invalidas'
  | 'email-registrado'
  | 'sin-red'
  | 'sesion-invalida'
  | 'desconocido';

/** Error de autenticación sin tipos de Supabase. */
export class AuthError extends Error {
  readonly tipo: TipoErrorAuth;

  constructor(tipo: TipoErrorAuth, message?: string) {
    super(message ?? tipo);
    this.name = 'AuthError';
    this.tipo = tipo;
  }
}

/** Puerto de autenticación remota. Lo implementa `src/sync/supabaseAuth.ts`. Rechaza con `AuthError`. */
export interface AuthRemotePort {
  iniciarSesion(email: string, password: string): Promise<PerfilActivo>;
  /** Registra una cuenta nueva; el servidor le asigna siempre el rol ATTENDEE. */
  registrarse(nombre: string, email: string, password: string): Promise<PerfilActivo>;
  /** Cierra la sesión solo en este dispositivo; no necesita red. */
  cerrarSesion(): Promise<void>;
  /** Valida la sesión contra el servidor y relee la propia fila de `users`. */
  leerPerfil(): Promise<PerfilActivo>;
}
