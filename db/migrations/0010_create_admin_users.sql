-- Up Migration
CREATE TABLE admin_users (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email           text NOT NULL UNIQUE,
  password_hash   text NOT NULL,                      -- argon2id
  totp_secret_enc text,                               -- optional TOTP, encrypted with an app key (not in DB)
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_login_at   timestamptz
);
-- Exactly one owner row: unique constant expression index.
CREATE UNIQUE INDEX admin_users_single ON admin_users ((true));

-- Down Migration
DROP TABLE admin_users;
