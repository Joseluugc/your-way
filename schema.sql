-- Esquema base de la base central (Supabase / PostgreSQL).
-- Refleja el resultado de aplicar supabase/migrations/0001, 0002 y 0003 sobre el esquema inicial.
-- Datos de la demo: supabase/seed.sql.

-- Extensión usada por el valor por defecto de `eventos.id`.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Auditoría (Spec 06): `updated_at` lo fija siempre el servidor.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Las 8 tablas principales llevan UUID v4 y columnas de auditoría:
--   created_at, updated_at (cursor de sincronización) y deleted_at (borrado lógico, NULL = activo).

-- 1. Usuarios y Roles
CREATE TYPE user_role AS ENUM ('ATTENDEE', 'VIP', 'STAFF', 'EXHIBITOR');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'ATTENDEE',
    company VARCHAR(100),
    linkedin_url VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 2. Estands de Expositores (evento_id y zone_id se añaden más abajo, tras eventos y zones)
CREATE TABLE stands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    map_x FLOAT NOT NULL,
    map_y FLOAT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 3. Zonas y Control de Aforo
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    max_capacity INT NOT NULL,
    current_capacity INT DEFAULT 0,
    required_role user_role DEFAULT 'ATTENDEE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 4. Hardware NFC (Pulseras, Estands y Puertas)
--    `id` es la clave primaria; `uid` es el UID físico de la etiqueta (clave natural).
CREATE TYPE nfc_type AS ENUM ('USER_WRISTBAND', 'STAND_POINT', 'ZONE_CHECKPOINT');

CREATE TABLE nfc_tags (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    uid VARCHAR(50) NOT NULL,
    type nfc_type NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES stands(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT nfc_tags_pkey PRIMARY KEY (id),
    CONSTRAINT nfc_tags_uid_key UNIQUE (uid)
);

-- 5. Transaccional: Sellos de Gamificación
CREATE TABLE stamps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES stands(id) ON DELETE CASCADE,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT unique_user_stand_stamp UNIQUE (user_id, stand_id)
);

-- 6. Transaccional: Valoraciones de Estands
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES stands(id) ON DELETE CASCADE,
    score INT CHECK (score BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 7. Transaccional: Intercambio de Contactos P2B / P2P
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scanner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scanned_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 8. Transaccional: Logs de Aforo por Zona
CREATE TYPE access_action AS ENUM ('ENTRY', 'EXIT');

CREATE TABLE access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
    action access_action NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 9. Tabla Eventos (agenda del evento; espejo de la tabla local SQLite `eventos`)
CREATE TABLE eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(200) NOT NULL,
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    ubicacion VARCHAR(255) NOT NULL,
    descripcion TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT eventos_rango_fechas CHECK (fecha_fin > fecha_inicio)
);

CREATE INDEX idx_eventos_fecha_inicio ON eventos(fecha_inicio);
CREATE INDEX idx_eventos_updated_at ON eventos(updated_at);

-- Sync (Spec 07): trigger y RLS en supabase/migrations/0001_eventos_sync.sql
CREATE FUNCTION set_eventos_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_eventos_updated_at
BEFORE INSERT OR UPDATE ON eventos
FOR EACH ROW EXECUTE FUNCTION set_eventos_updated_at();

ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY eventos_select ON eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY eventos_insert ON eventos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY eventos_update ON eventos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Estand → evento (Spec 03; asegurado en 0003_core_audit.sql)
ALTER TABLE stands ADD COLUMN evento_id UUID REFERENCES eventos(id) ON DELETE SET NULL;
CREATE INDEX idx_stands_evento_id ON stands(evento_id);

-- Sincronización de las 8 tablas principales (Spec 06, 0003_core_audit.sql):
-- trigger de updated_at, índice del cursor y RLS (SELECT, INSERT, UPDATE; sin DELETE).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'nfc_tags', 'stands', 'zones', 'stamps', 'ratings', 'leads', 'access_logs'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      'trg_' || t || '_updated_at', t
    );
    EXECUTE format('CREATE INDEX %I ON %I (updated_at)', 'idx_' || t || '_updated_at', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
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

-- 10. Tabla de Notificaciones
-- Pendiente: el contrato de notificaciones lo define la Spec 03 (tipo, contenido,
-- zona relacionada y fecha). En local se cachean en `cached_notifications`.

-- 11. Gamificación, pasaporte digital y valoración (Spec 04)
-- Migración: supabase/migrations/0002_gamification.sql (allí también se copian stamps/ratings).
-- Estand → zona (×2 por aforo y SECTOR_EXPLORER). Nullable: un estand sin zona no recibe bono.
ALTER TABLE stands ADD COLUMN zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;
CREATE INDEX idx_stands_zone_id ON stands(zone_id);

-- Facciones del evento (las crea la organización; el cliente solo las descarga).
CREATE TABLE factions (
    id UUID PRIMARY KEY,
    evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    color_hex CHAR(7) NOT NULL CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT factions_evento_name_key UNIQUE (evento_id, name)
);

CREATE TABLE attendee_factions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    faction_id UUID NOT NULL REFERENCES factions(id),
    assigned_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT attendee_factions_user_evento_key UNIQUE (user_id, evento_id)
);
CREATE INDEX idx_attendee_factions_faction_id ON attendee_factions(faction_id);

CREATE TABLE stand_trivia (
    id UUID PRIMARY KEY,
    stand_id UUID NOT NULL UNIQUE REFERENCES stands(id) ON DELETE CASCADE,
    question VARCHAR(200) NOT NULL CHECK (length(question) > 0),
    options_json JSONB NOT NULL
        CHECK (jsonb_typeof(options_json) = 'array' AND jsonb_array_length(options_json) = 3),
    correct_option_index SMALLINT NOT NULL CHECK (correct_option_index BETWEEN 0 AND 2),
    bonus_xp INT NOT NULL DEFAULT 50 CHECK (bonus_xp > 0)
);

CREATE TABLE user_stamps (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    stand_id UUID NOT NULL REFERENCES stands(id),
    evento_id UUID NOT NULL REFERENCES eventos(id),
    scanned_at TIMESTAMPTZ NOT NULL,
    zone_level_at_scan TEXT
        CHECK (zone_level_at_scan IN ('available', 'medium', 'full', 'unavailable')),
    applied_multiplier NUMERIC(4,2) NOT NULL CHECK (applied_multiplier >= 1),
    trivia_result TEXT NOT NULL
        CHECK (trivia_result IN ('PENDING', 'CORRECT', 'WRONG', 'TIMEOUT', 'SKIPPED')),
    trivia_answered_at TIMESTAMPTZ,
    CONSTRAINT user_stamps_user_stand_key UNIQUE (user_id, stand_id)
);
CREATE INDEX idx_user_stamps_user_evento ON user_stamps(user_id, evento_id);
CREATE INDEX idx_user_stamps_stand_id ON user_stamps(stand_id);

CREATE TABLE stand_ratings (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    stand_id UUID NOT NULL REFERENCES stands(id),
    stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT stand_ratings_user_stand_key UNIQUE (user_id, stand_id)
);
CREATE INDEX idx_stand_ratings_stand_id ON stand_ratings(stand_id);

-- Libro mayor append-only: sin policies de UPDATE ni DELETE.
CREATE TABLE xp_transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    faction_id UUID REFERENCES factions(id),
    evento_id UUID NOT NULL REFERENCES eventos(id),
    source_type TEXT NOT NULL
        CHECK (source_type IN ('STAMP', 'TRIVIA', 'RATING', 'ACHIEVEMENT', 'ROULETTE')),
    reference_id UUID NOT NULL,
    base_xp INT NOT NULL CHECK (base_xp > 0),
    multiplier NUMERIC(4,2) NOT NULL CHECK (multiplier >= 1),
    final_xp INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT xp_transactions_source_reference_key UNIQUE (source_type, reference_id)
);
CREATE INDEX idx_xp_transactions_user_evento ON xp_transactions(user_id, evento_id);
CREATE INDEX idx_xp_transactions_faction_id ON xp_transactions(faction_id);

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    evento_id UUID NOT NULL REFERENCES eventos(id),
    code TEXT NOT NULL
        CHECK (code IN ('EARLY_BIRD', 'EXPERT_CRITIC', 'SECTOR_EXPLORER', 'SPEEDRUNNER')),
    unlocked_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT user_achievements_user_evento_code_key UNIQUE (user_id, evento_id, code)
);

CREATE TABLE roulette_spins (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    evento_id UUID NOT NULL REFERENCES eventos(id),
    trigger_stamp_count INT NOT NULL CHECK (trigger_stamp_count > 0),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SPUN', 'CONSUMED', 'CLAIMED')),
    reward_type TEXT
        CHECK (reward_type IN ('XP_200', 'MULTIPLIER_1_5', 'RAFFLE_TICKET', 'PHYSICAL_PRIZE')),
    spun_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    CONSTRAINT roulette_spins_status_reward_check CHECK ((status = 'PENDING') = (reward_type IS NULL)),
    CONSTRAINT roulette_spins_user_evento_trigger_key UNIQUE (user_id, evento_id, trigger_stamp_count)
);

CREATE TABLE gamification_config (
    evento_id UUID PRIMARY KEY REFERENCES eventos(id) ON DELETE CASCADE,
    spin_every_n_stamps INT NOT NULL DEFAULT 3 CHECK (spin_every_n_stamps >= 1),
    roulette_weights_json JSONB NOT NULL
        DEFAULT '{"XP_200":40,"MULTIPLIER_1_5":30,"RAFFLE_TICKET":20,"PHYSICAL_PRIZE":10}'::jsonb
        CHECK (jsonb_typeof(roulette_weights_json) = 'object')
);

-- RLS: SELECT e INSERT para authenticated (incluye sesiones anónimas) en todas las tablas;
-- UPDATE solo donde el estado avanza (trivia del sello y estado de la tirada). Sin DELETE.
ALTER TABLE factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendee_factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stand_trivia ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE stand_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE roulette_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY factions_select ON factions FOR SELECT TO authenticated USING (true);
CREATE POLICY factions_insert ON factions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY attendee_factions_select ON attendee_factions FOR SELECT TO authenticated USING (true);
CREATE POLICY attendee_factions_insert ON attendee_factions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY stand_trivia_select ON stand_trivia FOR SELECT TO authenticated USING (true);
CREATE POLICY stand_trivia_insert ON stand_trivia FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY user_stamps_select ON user_stamps FOR SELECT TO authenticated USING (true);
CREATE POLICY user_stamps_insert ON user_stamps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY user_stamps_update ON user_stamps FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY stand_ratings_select ON stand_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY stand_ratings_insert ON stand_ratings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY xp_transactions_select ON xp_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY xp_transactions_insert ON xp_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY user_achievements_select ON user_achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY user_achievements_insert ON user_achievements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY roulette_spins_select ON roulette_spins FOR SELECT TO authenticated USING (true);
CREATE POLICY roulette_spins_insert ON roulette_spins FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY roulette_spins_update ON roulette_spins FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY gamification_config_select ON gamification_config FOR SELECT TO authenticated USING (true);
CREATE POLICY gamification_config_insert ON gamification_config FOR INSERT TO authenticated WITH CHECK (true);
