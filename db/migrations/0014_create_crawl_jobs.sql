-- Up Migration
CREATE TABLE crawl_jobs (                             -- also the work queue (FOR UPDATE SKIP LOCKED)
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id         bigint NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  params            jsonb NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  run_after         timestamptz NOT NULL DEFAULT now(),
  attempts          smallint NOT NULL DEFAULT 0,
  locked_by         text,
  heartbeat_at      timestamptz,
  started_at        timestamptz,
  finished_at       timestamptz,
  fetched_count     int NOT NULL DEFAULT 0,
  quarantined_count int NOT NULL DEFAULT 0,
  error_count       int NOT NULL DEFAULT 0,
  requested_by      bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crawl_jobs_queue_idx ON crawl_jobs (run_after) WHERE status = 'queued';
CREATE INDEX crawl_jobs_source_id_idx ON crawl_jobs (source_id);
CREATE INDEX crawl_jobs_requested_by_idx ON crawl_jobs (requested_by);

-- Down Migration
DROP TABLE crawl_jobs;
