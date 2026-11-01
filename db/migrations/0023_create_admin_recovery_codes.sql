-- Up Migration
CREATE TABLE admin_recovery_codes (                   -- TOTP recovery codes (8 per owner), stored hashed only
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id bigint NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  code_hash     text NOT NULL,                        -- argon2id hash of the code; the plain code is shown once
  used_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_recovery_codes_admin_user_id_idx ON admin_recovery_codes (admin_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_recovery_codes TO bj_api;

-- Down Migration
DROP TABLE admin_recovery_codes;
