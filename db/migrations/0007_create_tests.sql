-- Up Migration
CREATE TABLE tests (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          text NOT NULL UNIQUE,                 -- lop-6/ngu-phap/thi-hien-tai-don/de-1 | thi-vao-lop-10/de-1
  grade         smallint NOT NULL CHECK (grade BETWEEN 6 AND 9),
  skill         text CHECK (skill IN ('doc-hieu','ngu-phap','tu-vung','viet-cau')),
  topic_id      bigint REFERENCES topics(id) ON DELETE RESTRICT,
  kind          text NOT NULL CHECK (kind IN ('topic','mixed','entrance10')),
  title         text NOT NULL,
  seed          text NOT NULL DEFAULT '',
  review_status text NOT NULL DEFAULT 'draft'
                CHECK (review_status IN ('draft','in_review','published','archived')),
  published_at  timestamptz,
  version       int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'entrance10') = (skill IS NULL AND topic_id IS NULL)),
  CHECK (review_status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX tests_pub_idx ON tests (grade, skill, topic_id) WHERE review_status = 'published';
CREATE INDEX tests_topic_id_idx ON tests (topic_id);
CREATE TRIGGER tests_touch BEFORE UPDATE ON tests FOR EACH ROW EXECUTE FUNCTION bj_touch();

-- Down Migration
DROP TABLE tests;
