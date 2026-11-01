-- Up Migration
CREATE TABLE question_revisions (        -- every CMS edit/status change keeps the previous snapshot
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version     int NOT NULL,
  snapshot    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, version)
);

-- Down Migration
DROP TABLE question_revisions;
