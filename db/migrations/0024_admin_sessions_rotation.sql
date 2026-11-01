-- Up Migration
-- expires_at stays the idle deadline (8 h, slid on use); absolute_expires_at caps the lifetime (7 d).
ALTER TABLE admin_sessions
  ADD COLUMN absolute_expires_at timestamptz,
  ADD COLUMN rotated_from text;                       -- id of the session replaced on login/rotation
UPDATE admin_sessions SET absolute_expires_at = expires_at WHERE absolute_expires_at IS NULL;
ALTER TABLE admin_sessions ALTER COLUMN absolute_expires_at SET NOT NULL;

-- Down Migration
ALTER TABLE admin_sessions DROP COLUMN rotated_from, DROP COLUMN absolute_expires_at;
