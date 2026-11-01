-- Up Migration
CREATE TABLE crawl_errors (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crawl_job_id bigint NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  url          text,
  kind         text NOT NULL,
  message      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crawl_errors_crawl_job_id_idx ON crawl_errors (crawl_job_id);

-- Down Migration
DROP TABLE crawl_errors;
