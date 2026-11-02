-- Up Migration
-- Only bj_api touches account tables (worker and web get nothing). deletion_requests is append-only.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, identities, profiles, profile_attempts, user_sessions, user_tokens, consents
  TO bj_api;
GRANT SELECT, INSERT ON deletion_requests TO bj_api;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO bj_api;

-- Down Migration
REVOKE ALL ON
  users, identities, profiles, profile_attempts, user_sessions, user_tokens, consents, deletion_requests
  FROM bj_api;
