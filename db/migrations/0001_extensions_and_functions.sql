-- Up Migration
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() is only STABLE; an IMMUTABLE wrapper is required for indexes and generated columns.
CREATE FUNCTION bj_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE FUNCTION bj_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Down Migration
DROP FUNCTION bj_touch();
DROP FUNCTION bj_unaccent(text);
DROP EXTENSION pg_trgm;
DROP EXTENSION unaccent;
