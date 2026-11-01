-- Up Migration
CREATE TABLE passages (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id   text NOT NULL UNIQUE,                 -- JSON id (voa-p-..., gov-p-...)
  source_id     bigint NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  title         text NOT NULL,
  body          text NOT NULL,
  word_count    int NOT NULL CHECK (word_count > 0),
  level         smallint NOT NULL CHECK (level BETWEEN 1 AND 5),
  source_url    text,
  crawled_at    timestamptz,
  review_status text NOT NULL DEFAULT 'quarantine'
                CHECK (review_status IN ('quarantine','draft','in_review','published','rejected','archived')),
  review_note   text,
  reviewed_at   timestamptz,
  published_at  timestamptz,
  version       int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (review_status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX passages_source_id_idx ON passages (source_id);
CREATE INDEX passages_status_idx ON passages (review_status, updated_at DESC);
CREATE TRIGGER passages_touch BEFORE UPDATE ON passages FOR EACH ROW EXECUTE FUNCTION bj_touch();

-- Down Migration
DROP TABLE passages;
