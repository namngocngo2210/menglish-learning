-- Up Migration
CREATE TABLE outbox_events (                          -- publish -> web cache purge (transactional outbox)
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind         text NOT NULL,                         -- purge_paths | rebuild
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  attempts     smallint NOT NULL DEFAULT 0
);
CREATE INDEX outbox_pending_idx ON outbox_events (id) WHERE delivered_at IS NULL;

-- Down Migration
DROP TABLE outbox_events;
