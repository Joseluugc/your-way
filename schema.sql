-- Habilitar extensión para UUIDs en PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Usuarios y Roles
CREATE TYPE user_role AS ENUM ('ATTENDEE', 'VIP', 'STAFF', 'EXHIBITOR');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'ATTENDEE',
    company VARCHAR(100),
    linkedin_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Estands de Expositores
CREATE TABLE stands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    map_x FLOAT NOT NULL,
    map_y FLOAT NOT NULL
);

-- 3. Zonas y Control de Aforo
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    max_capacity INT NOT NULL,
    current_capacity INT DEFAULT 0,
    required_role user_role DEFAULT 'ATTENDEE'
);

-- 4. Hardware NFC (Pulseras, Estands y Puertas)
CREATE TYPE nfc_type AS ENUM ('USER_WRISTBAND', 'STAND_POINT', 'ZONE_CHECKPOINT');

CREATE TABLE nfc_tags (
    uid VARCHAR(50) PRIMARY KEY,
    type nfc_type NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES stands(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE CASCADE
);

-- 5. Transaccional: Sellos de Gamificación
CREATE TABLE stamps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES stands(id) ON DELETE CASCADE,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_stand_stamp UNIQUE (user_id, stand_id)
);

-- 6. Transaccional: Valoraciones de Estands
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES stands(id) ON DELETE CASCADE,
    score INT CHECK (score BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Transaccional: Intercambio de Contactos P2B / P2P
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scanner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scanned_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Transaccional: Logs de Aforo por Zona
CREATE TYPE access_action AS ENUM ('ENTRY', 'EXIT');

CREATE TABLE access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
    action access_action NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- 10. Tabla de Notificaciones
-- Pendiente: el contrato de notificaciones lo define la Spec 03 (tipo, contenido,
-- zona relacionada y fecha). En local se cachean en `cached_notifications`.
