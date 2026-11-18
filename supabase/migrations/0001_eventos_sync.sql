-- Spec 07: sincronización de eventos (SQLite <-> Supabase)

ALTER TABLE eventos ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE eventos ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_eventos_updated_at ON eventos(updated_at);

-- updated_at lo fija siempre el servidor (cursor de bajada fiable)
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

-- RLS: solo usuarios autenticados (incluye sesiones anónimas). Sin policy de DELETE.
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY eventos_select ON eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY eventos_insert ON eventos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY eventos_update ON eventos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
