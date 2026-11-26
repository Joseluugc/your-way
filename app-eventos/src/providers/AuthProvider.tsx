import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useNetworkState } from 'expo-network';
import { AuthError, type PerfilActivo, type Rol } from '../domain/auth/authTypes';
import { validarCredenciales } from '../domain/auth/credenciales';
import {
  AVISO_SESION_CADUCADA,
  decidirTrasFalloRefresco,
  mensajeErrorAuth,
  parsearPerfil,
  serializarPerfil,
} from '../domain/auth/sesion';
import { SupabaseAuth } from '../sync/supabaseAuth';

/** Clave del perfil activo en el `localStorage` de expo-sqlite (instalado por src/lib/supabase.ts). */
const CLAVE_PERFIL = 'yourway:perfil';

export type EstadoAuth = 'sin-sesion' | 'con-sesion';

interface AuthContextValue {
  perfil: PerfilActivo | null;
  rol: Rol | null;
  estado: EstadoAuth;
  /** Aviso para la pantalla de login (p. ej. «Tu sesión ha caducado»). */
  aviso: string | null;
  /** Devuelve el mensaje de error para el formulario, o `null` si entra. */
  login: (email: string, password: string) => Promise<string | null>;
  /** Registra una cuenta ATTENDEE. Devuelve el mensaje de error, o `null` si entra. */
  register: (nombre: string, email: string, password: string) => Promise<string | null>;
  /** Cierra sesión en este dispositivo. No borra las filas `pending` de SQLite. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const authRemote = new SupabaseAuth();

/**
 * Sesión y perfil activo (Spec 08). La identidad offline sale del perfil guardado en el
 * dispositivo, no de la validez del token. Debe montarse dentro de `SQLiteProvider`.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const networkState = useNetworkState();
  // El localStorage de expo-sqlite es síncrono: el perfil guardado está disponible desde el
  // primer render, sin red y sin estado intermedio de carga.
  const [perfil, setPerfil] = useState<PerfilActivo | null>(() =>
    parsearPerfil(localStorage.getItem(CLAVE_PERFIL)),
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const estado: EstadoAuth = perfil ? 'con-sesion' : 'sin-sesion';

  const offline = networkState.isConnected === false || networkState.isInternetReachable === false;
  const online = networkState.isConnected === true && networkState.isInternetReachable !== false;
  const wasOnline = useRef<boolean | null>(null);

  const entrar = useCallback((nuevo: PerfilActivo) => {
    localStorage.setItem(CLAVE_PERFIL, serializarPerfil(nuevo));
    setPerfil(nuevo);
    setAviso(null);
  }, []);

  const autenticar = useCallback(
    async (operacion: () => Promise<PerfilActivo>): Promise<string | null> => {
      if (offline) return mensajeErrorAuth('sin-red');
      try {
        entrar(await operacion());
        return null;
      } catch (error) {
        return mensajeErrorAuth(error instanceof AuthError ? error.tipo : 'desconocido');
      }
    },
    [offline, entrar],
  );

  const login = useCallback(
    (email: string, password: string) => {
      const invalido = validarCredenciales({ email, password });
      if (invalido) return Promise.resolve(invalido);
      return autenticar(() => authRemote.iniciarSesion(email, password));
    },
    [autenticar],
  );

  const register = useCallback(
    (nombre: string, email: string, password: string) => {
      const invalido = validarCredenciales({ email, password, nombre });
      if (invalido) return Promise.resolve(invalido);
      return autenticar(() => authRemote.registrarse(nombre, email, password));
    },
    [autenticar],
  );

  /** Cierre local: borra el perfil y vuelve al login. Nunca toca las filas `pending` de SQLite. */
  const cerrar = useCallback(async (nuevoAviso: string | null) => {
    try {
      await authRemote.cerrarSesion();
    } catch (error) {
      // El cierre es local: aunque falle, el perfil se borra y se vuelve al login.
      console.warn('No se pudo cerrar la sesión de Supabase.', error);
    }
    localStorage.removeItem(CLAVE_PERFIL);
    setPerfil(null);
    setAviso(nuevoAviso);
  }, []);

  const logout = useCallback(() => cerrar(null), [cerrar]);

  const conSesion = perfil !== null;

  // Con red (al abrir la app o al recuperar la conexión) se valida la sesión y se relee la
  // propia fila de `users`: así llega un cambio de rol hecho en Supabase. Si falla por red, se
  // mantiene la sesión; si Supabase la rechaza, se vuelve al login con aviso.
  useEffect(() => {
    const previo = wasOnline.current;
    wasOnline.current = online;
    if (!online || previo === true || !conSesion) return;

    let activo = true;
    authRemote
      .leerPerfil()
      .then((actualizado) => {
        if (activo) entrar(actualizado);
      })
      .catch((error: unknown) => {
        const tipo = error instanceof AuthError ? error.tipo : 'desconocido';
        if (activo && decidirTrasFalloRefresco(tipo) === 'cerrar') {
          void cerrar(AVISO_SESION_CADUCADA);
        } else {
          console.warn('No se pudo releer el perfil; se mantiene el guardado.', error);
        }
      });

    return () => {
      activo = false;
    };
  }, [online, conSesion, entrar, cerrar]);

  const value = useMemo(
    () => ({ perfil, rol: perfil?.rol ?? null, estado, aviso, login, register, logout }),
    [perfil, estado, aviso, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }
  return context;
}
