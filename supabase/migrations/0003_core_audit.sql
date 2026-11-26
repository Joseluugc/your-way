-- Spec 06 (US-06.1): auditoría, UUID y RLS de las 8 tablas principales.
--
-- Requiere 0001_eventos_sync.sql y 0002_gamification.sql aplicadas.
-- Aplica a users, nfc_tags, stands, zones, stamps, ratings, leads y access_logs el patrón de
-- sincronización de la Spec 07: UUID v4, `updated_at` fijado por el servidor (cursor de bajada),
-- borrado lógico con `deleted_at` y RLS para `authenticated` sin policy de DELETE.

BEGIN;

-- 1. Claves primarias UUID v4 generadas por defecto en el servidor.
--    (El cliente sigue enviando sus propios UUID; el valor por defecto cubre los inserts manuales.)
ALTER TABLE users       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE stands      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE zones       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE stamps      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE ratings     ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE leads       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE access_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- nfc_tags: `id` UUID pasa a ser la clave primaria y `uid` (UID físico de la etiqueta)
-- queda como clave natural UNIQUE. Las filas existentes reciben un UUID cada una.
ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid();

DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT conname INTO pk_name
  FROM pg_constraint
  WHERE conrelid = 'public.nfc_tags'::regclass AND contype = 'p';

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE nfc_tags DROP CONSTRAINT %I', pk_name);
  END IF;
END;
$$;

ALTER TABLE nfc_tags ALTER COLUMN uid SET NOT NULL;
ALTER TABLE nfc_tags ADD CONSTRAINT nfc_tags_uid_key UNIQUE (uid);
ALTER TABLE nfc_tags ADD CONSTRAINT nfc_tags_pkey PRIMARY KEY (id);

-- 2. Estand → evento. La app lo usa desde la Spec 03 y 0002 lo necesita, pero no constaba
--    en ninguna migración: se asegura aquí (no hace nada si la columna ya existe).
ALTER TABLE stands ADD COLUMN IF NOT EXISTS evento_id UUID REFERENCES eventos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stands_evento_id ON stands(evento_id);

-- 3. created_at. users y ratings ya lo tenían como TIMESTAMP (hora UTC, sin zona horaria).
ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
UPDATE users SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE users ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE ratings ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
UPDATE ratings SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE ratings ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE ratings ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE nfc_tags    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE stands      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE zones       ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE stamps      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE leads       ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- En las tablas transaccionales, la fecha real de creación es la del escaneo o acceso.
UPDATE stamps      SET created_at = scanned_at AT TIME ZONE 'UTC'  WHERE scanned_at IS NOT NULL;
UPDATE leads       SET created_at = scanned_at AT TIME ZONE 'UTC'  WHERE scanned_at IS NOT NULL;
UPDATE access_logs SET created_at = "timestamp" AT TIME ZONE 'UTC' WHERE "timestamp" IS NOT NULL;

-- 4. updated_at (cursor de sincronización) y deleted_at (borrado lógico, NULL = activo).
ALTER TABLE users       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE nfc_tags    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE stands      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE zones       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE stamps      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ratings     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE leads       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE users       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE nfc_tags    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE stands      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE zones       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE stamps      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE ratings     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE leads       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 5. updated_at lo fija siempre el servidor: se ignora cualquier valor enviado por el cliente.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 6. Para cada tabla: trigger de updated_at, índice del cursor, RLS y policies.
--    RLS: SELECT, INSERT y UPDATE para authenticated (incluye sesiones anónimas). Sin DELETE.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'nfc_tags', 'stands', 'zones', 'stamps', 'ratings', 'leads', 'access_logs'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || t || '_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      'trg_' || t || '_updated_at', t
    );

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (updated_at)', 'idx_' || t || '_updated_at', t);

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', t || '_select', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)', t || '_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      t || '_update', t
    );
  END LOOP;
END;
$$;

COMMIT;
