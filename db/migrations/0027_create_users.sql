-- Up Migration
-- Parent accounts (adults only). Distinct principal from admin_users: own tables, cookie and HMAC key.
CREATE TABLE users (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email             text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  email_verified_at timestamptz,
  password_hash     text,                             -- argon2id; NULL when the account signs in with Google only
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_login_at     timestamptz
);
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- Down Migration
DROP TABLE users;
