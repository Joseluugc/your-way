-- Spec 08 (US-08.1, US-08.3): autenticación con email y contraseña y roles asignados por STAFF.
--
-- Requiere 0001, 0002 y 0003 aplicadas. Idempotente: se puede ejecutar varias veces.
-- Después, en el panel de Supabase (Authentication → Sign In / Providers):
--   - desactivar "Allow anonymous sign-ins" (la app ya no usa sesiones anónimas);
--   - desactivar "Confirm email" (el registro entra directamente, siempre como ATTENDEE).

BEGIN;

-- 1. Código del evento para unirse en el futuro (NULL = sin código). En esta spec solo lo
--    tiene el evento demo (seed.sql).
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS codigo VARCHAR(12) UNIQUE;

-- 2. Pertenencia de usuarios a eventos (un usuario puede estar en varios eventos).
CREATE TABLE IF NOT EXISTS evento_miembros (
  evento_id  UUID NOT NULL REFERENCES eventos(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (evento_id, user_id)
);

-- `updated_at` lo fija el servidor (función set_updated_at() de 0003).
DROP TRIGGER IF EXISTS trg_evento_miembros_updated_at ON evento_miembros;
CREATE TRIGGER trg_evento_miembros_updated_at
BEFORE INSERT OR UPDATE ON evento_miembros
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_evento_miembros_updated_at ON evento_miembros (updated_at);
CREATE INDEX IF NOT EXISTS idx_evento_miembros_user_id ON evento_miembros (user_id);

-- 3. ¿El usuario de la sesión es STAFF? SECURITY DEFINER para leer `users` sin depender de RLS.
CREATE OR REPLACE FUNCTION is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'STAFF' AND deleted_at IS NULL
  );
$$;

-- 4. Al registrarse en Supabase Auth se crea la fila de `users` con el mismo id, siempre ATTENDEE.
--    Las cuentas demo ya existen en seed.sql: ON CONFLICT (id) DO NOTHING.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    'ATTENDEE'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. Solo un STAFF cambia `role`. Una policy no puede comparar la fila antigua con la nueva,
--    así que lo impone un trigger. Solo se aplica a peticiones de la API (roles authenticated
--    y anon): el panel y el SQL Editor (postgres) pueden seguir cambiando roles.
CREATE OR REPLACE FUNCTION proteger_role() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user IN ('authenticated', 'anon')
     AND NOT is_staff() THEN
    RAISE EXCEPTION 'Solo un STAFF puede cambiar el rol de un usuario'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_proteger_role ON users;
CREATE TRIGGER trg_users_proteger_role
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION proteger_role();

-- 6. RLS de `users` (sustituye a INSERT y UPDATE de 0003; SELECT no cambia).
--    Sin INSERT desde el cliente (lo hace handle_new_user) y sin DELETE.
DROP POLICY IF EXISTS users_insert ON users;
DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update ON users FOR UPDATE TO authenticated
  USING (id = auth.uid() OR is_staff())
  WITH CHECK (id = auth.uid() OR is_staff());

-- 7. RLS de `evento_miembros`: cada uno ve sus filas; STAFF ve y gestiona todas. Sin DELETE.
ALTER TABLE evento_miembros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evento_miembros_select ON evento_miembros;
DROP POLICY IF EXISTS evento_miembros_insert ON evento_miembros;
DROP POLICY IF EXISTS evento_miembros_update ON evento_miembros;
CREATE POLICY evento_miembros_select ON evento_miembros FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_staff());
CREATE POLICY evento_miembros_insert ON evento_miembros FOR INSERT TO authenticated
  WITH CHECK (is_staff());
CREATE POLICY evento_miembros_update ON evento_miembros FOR UPDATE TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

COMMIT;
