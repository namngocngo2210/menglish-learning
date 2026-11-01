-- Up Migration
-- Only members of bj_api or bj_migrate (and superusers, who are members of every role) may set
-- review_status = 'published'. bj_worker may only insert quarantine rows. This holds even if the
-- crawler is exploited: it cannot publish anything.
CREATE FUNCTION bj_guard_publish() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  becomes_published boolean :=
    NEW.review_status = 'published'
    AND (TG_OP = 'INSERT' OR OLD.review_status IS DISTINCT FROM 'published');
BEGIN
  IF becomes_published
     AND NOT (pg_has_role(current_user, 'bj_api', 'MEMBER')
              OR pg_has_role(current_user, 'bj_migrate', 'MEMBER')) THEN
    RAISE EXCEPTION 'role % may not publish %', current_user, TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'INSERT'
     AND pg_has_role(current_user, 'bj_worker', 'MEMBER')
     AND NOT (pg_has_role(current_user, 'bj_api', 'MEMBER')
              OR pg_has_role(current_user, 'bj_migrate', 'MEMBER'))
     AND NEW.review_status <> 'quarantine' THEN
    RAISE EXCEPTION 'role % may only insert quarantine rows into %', current_user, TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER questions_publish_guard BEFORE INSERT OR UPDATE OF review_status ON questions
  FOR EACH ROW EXECUTE FUNCTION bj_guard_publish();
CREATE TRIGGER passages_publish_guard BEFORE INSERT OR UPDATE OF review_status ON passages
  FOR EACH ROW EXECUTE FUNCTION bj_guard_publish();
CREATE TRIGGER tests_publish_guard BEFORE INSERT OR UPDATE OF review_status ON tests
  FOR EACH ROW EXECUTE FUNCTION bj_guard_publish();

-- Down Migration
DROP TRIGGER tests_publish_guard ON tests;
DROP TRIGGER passages_publish_guard ON passages;
DROP TRIGGER questions_publish_guard ON questions;
DROP FUNCTION bj_guard_publish();
