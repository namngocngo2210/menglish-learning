-- Up Migration
-- id = sha256(session token); the cookie holds the raw token. expires_at is the idle deadline (7 d, slid on use),
-- absolute_expires_at caps the lifetime (30 d).
CREATE TABLE user_sessions (
  id                  text PRIMARY KEY,
  user_id             bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_secret         text NOT NULL,
  ip_hash             text,
  user_agent_hash     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at          timestamptz,
  rotated_from        text
);
CREATE INDEX user_sessions_user_id_idx ON user_sessions (user_id);
CREATE INDEX user_sessions_expires_at_idx ON user_sessions (expires_at);

-- Down Migration
DROP TABLE user_sessions;
