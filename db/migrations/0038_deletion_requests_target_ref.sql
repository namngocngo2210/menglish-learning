-- Up Migration
-- Pseudonymous reference of the deleted profile (HMAC of its external id; null for account deletions).
-- Lets a restore of an OLD backup re-apply profile deletions (docs/runbook.md, backups and deletions).
ALTER TABLE deletion_requests ADD COLUMN target_ref text;
CREATE INDEX deletion_requests_target_ref_idx ON deletion_requests (target_ref);

-- Down Migration
DROP INDEX deletion_requests_target_ref_idx;
ALTER TABLE deletion_requests DROP COLUMN target_ref;
