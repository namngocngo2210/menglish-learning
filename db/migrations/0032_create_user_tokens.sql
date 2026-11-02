-- Up Migration
CREATE TABLE user_tokens (                          -- one-time email tokens; only the sha256 is stored
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose      text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_sha256 text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_tokens_user_id_idx ON user_tokens (user_id);

-- Down Migration
DROP TABLE user_tokens;
