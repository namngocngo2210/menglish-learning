-- Up Migration
CREATE TABLE raw_documents (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id    bigint NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url          text NOT NULL UNIQUE,
  content_hash text NOT NULL,
  storage_path text NOT NULL,                         -- file on the crawler volume, never a blob in the DB
  status       text NOT NULL CHECK (status IN ('fetched','parsed','failed','skipped')),
  fetched_at   timestamptz NOT NULL
);
CREATE INDEX raw_documents_source_id_idx ON raw_documents (source_id);

-- Down Migration
DROP TABLE raw_documents;
