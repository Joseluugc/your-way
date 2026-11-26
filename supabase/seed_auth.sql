-- Spec 08 (US-08.1): cuentas de login de la demo. SOLO para el proyecto de desarrollo.
--
-- Crea en Supabase Auth las cuentas de Elena Navarro (STAFF) y Ana Gómez (ATTENDEE) con los
-- mismos UUID que sus filas de `users` en seed.sql, el email confirmado y la contraseña de demo
-- `yourway-demo` (la usan los botones de acceso rápido del login, solo en __DEV__).
--
-- Ejecutar en el SQL Editor DESPUÉS de 0004_auth_roles.sql y seed.sql. Idempotente.
-- El trigger on_auth_user_created no duplica nada: las filas de `users` ya existen.
--
-- Columnas usadas (esquema `auth` de Supabase, puede cambiar entre versiones):
--   auth.users: instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
--     raw_app_meta_data, raw_user_meta_data, created_at, updated_at y los tokens de texto
--     (confirmation_token, recovery_token, email_change*, phone_change*, reauthentication_token),
--     que GoTrue espera como '' y no como NULL.
--   auth.identities: provider_id, user_id, identity_data, provider, last_sign_in_at,
--     created_at, updated_at.
-- Si falla en tu versión: crea las dos cuentas en Authentication → Users (email confirmado)
-- y ajusta los UUID de Elena y Ana en seed.sql y en app-eventos/src/database/demoSeedData.ts.

BEGIN;

WITH demo (id, email, name) AS (
  VALUES
    ('d1000000-0000-4000-8000-000000000008'::uuid, 'elena.navarro@yourway.demo', 'Elena Navarro'),
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'ana.gomez@yourway.demo', 'Ana Gómez')
)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
SELECT
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('yourway-demo', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('name', name), now(), now(),
  '', '', '', '', '', '', '', ''
FROM demo
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
SELECT
  u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
FROM auth.users u
WHERE u.id IN ('d1000000-0000-4000-8000-000000000008', 'd1000000-0000-4000-8000-000000000001')
ON CONFLICT (provider_id, provider) DO NOTHING;

COMMIT;
