-- Up Migration
CREATE TABLE sources (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code               text NOT NULL UNIQUE,           -- JSON id, e.g. voa-learning-english
  name               text NOT NULL,
  base_url           text NOT NULL,
  license            text NOT NULL,
  attribution        text NOT NULL,
  allowed_hosts      text[] NOT NULL DEFAULT '{}',   -- SSRF allowlist (exact host or *.suffix)
  enabled            boolean NOT NULL DEFAULT false, -- crawl allowed only when true
  license_checked_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER sources_touch BEFORE UPDATE ON sources FOR EACH ROW EXECUTE FUNCTION bj_touch();

-- Down Migration
DROP TABLE sources;
