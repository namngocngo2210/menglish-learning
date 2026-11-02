-- Up Migration
-- A parent links at most one account per provider; the (provider, subject) key already makes `sub` globally unique.
CREATE UNIQUE INDEX identities_user_provider_key ON identities (user_id, provider);
DROP INDEX identities_user_id_idx;                  -- covered by the new index

-- Down Migration
CREATE INDEX identities_user_id_idx ON identities (user_id);
DROP INDEX identities_user_provider_key;
