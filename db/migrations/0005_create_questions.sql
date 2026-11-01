-- Up Migration
CREATE TABLE questions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id   text NOT NULL UNIQUE,                 -- stable public id (voa-xxxxxxxx, gov-xxxxxxxx)
  type          text NOT NULL DEFAULT 'mcq' CHECK (type IN ('mcq')),
  grade         smallint NOT NULL CHECK (grade BETWEEN 6 AND 9),
  skill         text NOT NULL CHECK (skill IN ('doc-hieu','ngu-phap','tu-vung','viet-cau')),
  topic_id      bigint NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  difficulty    smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  passage_id    bigint REFERENCES passages(id) ON DELETE RESTRICT,
  stem          text NOT NULL,
  options       jsonb NOT NULL,                       -- [{"key":"A","text":"..."} x4] in ORIGINAL order
  correct_key   char(1) NOT NULL CHECK (correct_key IN ('A','B','C','D')),
  explanation   text NOT NULL,
  source_id     bigint NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  source_url    text NOT NULL,
  source_ref    text,                                 -- raw crawler string, kept verbatim
  provenance    jsonb NOT NULL DEFAULT '{}',          -- parsed source_ref (exam year/province/code/item/method)
  crawled_at    timestamptz,
  review_status text NOT NULL DEFAULT 'quarantine'
                CHECK (review_status IN ('quarantine','draft','in_review','published','rejected','archived')),
  review_note   text,
  reviewed_at   timestamptz,
  published_at  timestamptz,
  stem_norm     text GENERATED ALWAYS AS (lower(bj_unaccent(stem))) STORED, -- search / dedupe
  version       int NOT NULL DEFAULT 1,               -- optimistic locking for the CMS
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4),
  CHECK (review_status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX questions_pub_idx ON questions (grade, skill, topic_id, difficulty) WHERE review_status = 'published';
CREATE INDEX questions_status_idx ON questions (review_status, updated_at DESC);
CREATE INDEX questions_topic_id_idx ON questions (topic_id);
CREATE INDEX questions_passage_id_idx ON questions (passage_id);
CREATE INDEX questions_source_id_idx ON questions (source_id);
CREATE INDEX questions_stem_trgm ON questions USING gin (stem_norm gin_trgm_ops);
CREATE TRIGGER questions_touch BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION bj_touch();

-- Down Migration
DROP TABLE questions;
