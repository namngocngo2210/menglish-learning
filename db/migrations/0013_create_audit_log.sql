-- Up Migration
CREATE TABLE audit_log (                              -- append-only (bj_api has INSERT/SELECT only)
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     text,
  details       jsonb,
  ip_hash       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_admin_user_id_idx ON audit_log (admin_user_id);

-- Down Migration
DROP TABLE audit_log;
