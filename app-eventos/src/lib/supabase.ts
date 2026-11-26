import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_KEY. Crea app-eventos/.env.local (ver .env.example).',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * ¿Hay una sesión de Supabase utilizable para que RLS permita leer y escribir (`authenticated`)?
 * Reutiliza la sesión guardada y la renueva si el token ha caducado. Nunca lanza: sin sesión
 * (no se ha iniciado sesión, o el token caducó y no se pudo renovar sin red) devuelve `false`
 * y la sincronización se omite. Ya no hay sesiones anónimas (Spec 08).
 */
export async function ensureSession(): Promise<boolean> {
  const { data, error } = await supabase.auth.getSession();
  return !error && data.session !== null;
}
