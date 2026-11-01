-- Up Migration
ALTER TABLE admin_users
  ADD COLUMN failed_login_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN locked_until timestamptz;                -- per-account lockout after repeated failures

-- Down Migration
ALTER TABLE admin_users DROP COLUMN locked_until, DROP COLUMN failed_login_count;
