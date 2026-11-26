import {
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
} from '@supabase/supabase-js';
import {
  AuthError,
  type AuthRemotePort,
  type PerfilActivo,
  type TipoErrorAuth,
} from '../domain/auth/authTypes';
import { esRol } from '../domain/auth/sesion';
import { supabase } from '../lib/supabase';

/** Códigos de Supabase Auth que indican que la sesión guardada ya no sirve. */
const CODIGOS_SESION_INVALIDA = new Set([
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'user_not_found',
  'bad_jwt',
]);

/** Adaptador de Supabase Auth para el puerto `AuthRemotePort` (Spec 08). */
export class SupabaseAuth implements AuthRemotePort {
  async iniciarSesion(email: string, password: string): Promise<PerfilActivo> {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw aAuthError(error);
    return this.perfilTrasEntrar();
  }

  async registrarse(nombre: string, email: string, password: string): Promise<PerfilActivo> {
    // El rol no se envía: el trigger handle_new_user crea la fila de `users` como ATTENDEE.
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: nombre.trim() } },
    });
    if (error) throw aAuthError(error);
    // Con "Confirm email" desactivado, signUp devuelve la sesión. Sin ella no se puede entrar.
    if (!data.session) throw new AuthError('desconocido', 'El registro no devolvió una sesión.');
    return this.perfilTrasEntrar();
  }

  async cerrarSesion(): Promise<void> {
    // `local`: solo este dispositivo, sin llamar al servidor (funciona sin red).
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw aAuthError(error);
  }

  async leerPerfil(): Promise<PerfilActivo> {
    // getUser valida el token contra el servidor (renovándolo antes si ha caducado).
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw aAuthError(userError);
    if (!userData.user) throw new AuthError('sesion-invalida');

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (error) throw new AuthError('desconocido', error.message);
    if (!data) throw new AuthError('desconocido', 'La cuenta no tiene fila en users.');

    return aPerfil(data);
  }

  /** Lee el perfil recién iniciada la sesión; si falla, no deja una sesión a medias. */
  private async perfilTrasEntrar(): Promise<PerfilActivo> {
    try {
      return await this.leerPerfil();
    } catch (error) {
      await supabase.auth.signOut({ scope: 'local' });
      throw error;
    }
  }
}

function aPerfil(fila: Record<string, unknown>): PerfilActivo {
  const { id, name, email, role } = fila;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof email !== 'string' || !esRol(role)) {
    throw new AuthError('desconocido', 'La fila de users no tiene la forma esperada.');
  }
  return { id, nombre: name, email, rol: role };
}

function aAuthError(error: unknown): AuthError {
  const mensaje = error instanceof Error ? error.message : undefined;
  return new AuthError(clasificar(error), mensaje);
}

function clasificar(error: unknown): TipoErrorAuth {
  if (isAuthRetryableFetchError(error)) return 'sin-red';
  if (isAuthSessionMissingError(error)) return 'sesion-invalida';
  if (!isAuthApiError(error)) return 'desconocido';

  if (error.code === 'invalid_credentials') return 'credenciales-invalidas';
  if (error.code === 'user_already_exists' || error.code === 'email_exists') return 'email-registrado';
  if (
    (error.code !== undefined && CODIGOS_SESION_INVALIDA.has(error.code)) ||
    error.status === 401 ||
    error.status === 403
  ) {
    return 'sesion-invalida';
  }
  return 'desconocido';
}
