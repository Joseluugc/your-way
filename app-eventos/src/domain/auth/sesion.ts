import { ROLES, type PerfilActivo, type Rol, type TipoErrorAuth } from './authTypes.ts';

export const AVISO_SESION_CADUCADA = 'Tu sesión ha caducado';

/**
 * Qué hacer cuando falla la renovación o validación de la sesión.
 * Sin red se mantiene (la identidad offline sale del perfil guardado); solo se cierra
 * si Supabase rechaza la sesión.
 */
export function decidirTrasFalloRefresco(tipo: TipoErrorAuth): 'mantener' | 'cerrar' {
  return tipo === 'sesion-invalida' ? 'cerrar' : 'mantener';
}

const MENSAJES: Record<TipoErrorAuth, string> = {
  'credenciales-invalidas': 'Email o contraseña incorrectos',
  'email-registrado': 'Ese email ya está registrado',
  'sin-red': 'Necesitas conexión para iniciar sesión',
  'sesion-invalida': AVISO_SESION_CADUCADA,
  desconocido: 'No se pudo completar la operación. Inténtalo de nuevo.',
};

export function mensajeErrorAuth(tipo: TipoErrorAuth): string {
  return MENSAJES[tipo];
}

/** Lee el perfil guardado en el dispositivo; `null` si no hay o no tiene la forma esperada. */
export function parsearPerfil(json: string | null): PerfilActivo | null {
  if (!json) return null;

  let valor: unknown;
  try {
    valor = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof valor !== 'object' || valor === null) return null;
  const { id, nombre, email, rol } = valor as Record<string, unknown>;
  if (
    typeof id !== 'string' || id.length === 0 ||
    typeof nombre !== 'string' ||
    typeof email !== 'string' ||
    !esRol(rol)
  ) {
    return null;
  }
  return { id, nombre, email, rol };
}

export function serializarPerfil(perfil: PerfilActivo): string {
  return JSON.stringify(perfil);
}

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
}
