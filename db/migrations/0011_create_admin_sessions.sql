-- Up Migration
CREATE TABLE admin_sessions (
  id                text PRIMARY KEY,                 -- sha256(session token); the cookie holds the raw token
  admin_user_id     bigint NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  csrf_secret       text NOT NULL,
  ip_hash           text,
  user_agent_hash   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  revoked_at        timestamptz
);
CREATE INDEX admin_sessions_admin_user_id_idx ON admin_sessions (admin_user_id);
CREATE INDEX admin_sessions_expires_at_idx ON admin_sessions (expires_at);

-- Down Migration
DROP TABLE admin_sessions;
