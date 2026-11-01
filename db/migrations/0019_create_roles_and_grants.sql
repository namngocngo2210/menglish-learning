-- Up Migration
-- Group roles (NOLOGIN). Login roles with secret passwords are created by deploy tooling and
-- granted membership: GRANT bj_api TO <login role>. Roles are cluster-level, so they are
-- created idempotently and intentionally not dropped by the down migration.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['bj_migrate', 'bj_api', 'bj_worker', 'bj_web'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO bj_api, bj_worker, bj_web;

-- bj_api: content CRUD + admin tables; audit_log is append-only (INSERT/SELECT only).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  sources, topics, passages, questions, question_revisions, tests, test_items, mixer_presets,
  admin_users, admin_sessions, login_attempts, crawl_jobs, crawl_errors, raw_documents,
  question_reports, outbox_events
  TO bj_api;
GRANT SELECT, INSERT ON audit_log TO bj_api;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO bj_api;

-- bj_worker: reads reference data, inserts quarantine rows only (enforced by the publish guard
-- trigger), maintains its own queue rows. No UPDATE/DELETE on content, never touches admin tables.
GRANT SELECT ON sources, topics, passages, questions TO bj_worker;
GRANT INSERT ON passages, questions TO bj_worker;
GRANT SELECT, UPDATE ON crawl_jobs TO bj_worker;
GRANT SELECT, INSERT, UPDATE ON raw_documents TO bj_worker;
GRANT INSERT ON crawl_errors TO bj_worker;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO bj_worker;

-- Down Migration
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM bj_api, bj_worker;
REVOKE ALL ON
  sources, topics, passages, questions, question_revisions, tests, test_items, mixer_presets,
  admin_users, admin_sessions, login_attempts, crawl_jobs, crawl_errors, raw_documents,
  question_reports, outbox_events, audit_log
  FROM bj_api, bj_worker;
REVOKE USAGE ON SCHEMA public FROM bj_api, bj_worker, bj_web;
