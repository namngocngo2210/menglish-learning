-- Up Migration
-- The worker delivers outbox events (publish -> edge cache purge). It may mark them delivered but
-- cannot create or delete them; publishing itself stays in the api (trigger bj_guard_publish).
GRANT SELECT, UPDATE ON outbox_events TO bj_worker;
-- Down Migration
REVOKE UPDATE ON outbox_events FROM bj_worker;
REVOKE SELECT ON outbox_events FROM bj_worker;
