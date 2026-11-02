-- Up Migration
-- Owner decision 2/11 (ADR 0010): login = username, email optional. users.email now holds only a VERIFIED address.
CREATE EXTENSION IF NOT EXISTS citext;

-- Pending signups of the old email flow are unusable (no verified address); drop their unverified email first.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
UPDATE users SET email = NULL WHERE email_verified_at IS NULL;


ALTER TABLE users ADD COLUMN username citext;
ALTER TABLE users ADD COLUMN username_generated boolean NOT NULL DEFAULT false;
UPDATE users SET username = 'user' || id::text;      -- backfill; none expected on prod (ACCOUNTS_ENABLED was never on)
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,19}$');
CREATE UNIQUE INDEX users_username_key ON users (username);

ALTER TABLE users ADD CONSTRAINT users_email_verified CHECK (email IS NULL OR email_verified_at IS NOT NULL);
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE user_tokens ADD COLUMN email text;        -- the address a verify_email token proves

CREATE TABLE recovery_codes (                         -- one-time password recovery codes; only the sha256 is stored
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_sha256 text NOT NULL UNIQUE,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recovery_codes_user_id_idx ON recovery_codes (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON recovery_codes TO bj_api;

-- Down Migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE email IS NULL) THEN
    RAISE EXCEPTION 'cannot restore users.email NOT NULL: accounts without email exist';
  END IF;
END $$;
DROP TABLE recovery_codes;
ALTER TABLE user_tokens DROP COLUMN email;
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE users DROP CONSTRAINT users_email_verified;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
DROP INDEX users_username_key;
ALTER TABLE users DROP CONSTRAINT users_username_format;
ALTER TABLE users DROP COLUMN username_generated;
ALTER TABLE users DROP COLUMN username;
