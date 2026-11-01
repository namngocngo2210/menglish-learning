-- BeeJunior backend: DRAFT schema (blueprint). Postgres 16. Not a migration.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() is only STABLE; an IMMUTABLE wrapper is needed for indexes/generated columns.
CREATE FUNCTION bj_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE FUNCTION bj_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

-- ---------- content ----------
CREATE TABLE sources (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code               text NOT NULL UNIQUE,                 -- JSON id: voa-learning-english, gov-bf84254d
  name               text NOT NULL,
  base_url           text NOT NULL,
  license            text NOT NULL,
  attribution        text NOT NULL,
  allowed_hosts      text[] NOT NULL DEFAULT '{}',          -- SSRF allowlist (exact host or *.suffix)
  enabled            boolean NOT NULL DEFAULT false,        -- crawl allowed only when true
  license_checked_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE topics (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grade       smallint NOT NULL CHECK (grade BETWEEN 6 AND 9),
  skill       text NOT NULL CHECK (skill IN ('doc-hieu','ngu-phap','tu-vung','viet-cau')),
  slug        text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order  int  NOT NULL DEFAULT 0,
  UNIQUE (grade, skill, slug)
);

CREATE TABLE passages (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id   text NOT NULL UNIQUE,                       -- JSON id (voa-p-..., gov-p-...)
  source_id     bigint NOT NULL REFERENCES sources(id),
  title         text NOT NULL,
  body          text NOT NULL,
  word_count    int  NOT NULL CHECK (word_count > 0),
  level         smallint NOT NULL CHECK (level BETWEEN 1 AND 5),
  source_url    text,
  crawled_at    timestamptz,
  review_status text NOT NULL DEFAULT 'quarantine'
                CHECK (review_status IN ('quarantine','draft','in_review','published','rejected','archived')),
  review_note   text,
  reviewed_at   timestamptz,
  published_at  timestamptz,
  version       int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id   text NOT NULL UNIQUE,                       -- JSON id (voa-xxxxxxxx, gov-xxxxxxxx) = stable public id
  type          text NOT NULL DEFAULT 'mcq' CHECK (type IN ('mcq')),
  grade         smallint NOT NULL CHECK (grade BETWEEN 6 AND 9),
  skill         text NOT NULL CHECK (skill IN ('doc-hieu','ngu-phap','tu-vung','viet-cau')),
  topic_id      bigint NOT NULL REFERENCES topics(id),
  difficulty    smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  passage_id    bigint REFERENCES passages(id),
  stem          text NOT NULL,
  options       jsonb NOT NULL,                             -- [{"key":"A","text":"..."} x4] in ORIGINAL order
  correct_key   char(1) NOT NULL CHECK (correct_key IN ('A','B','C','D')),
  explanation   text NOT NULL,
  source_id     bigint NOT NULL REFERENCES sources(id),
  source_url    text NOT NULL,
  source_ref    text,                                       -- raw string from crawler (kept verbatim)
  provenance    jsonb NOT NULL DEFAULT '{}',                -- parsed sourceRef: exam year/province/code/number, ocr method
  crawled_at    timestamptz,
  review_status text NOT NULL DEFAULT 'quarantine'
                CHECK (review_status IN ('quarantine','draft','in_review','published','rejected','archived')),
  review_note   text,
  reviewed_at   timestamptz,
  published_at  timestamptz,
  stem_norm     text GENERATED ALWAYS AS (lower(bj_unaccent(stem))) STORED,   -- search / dedupe
  version       int NOT NULL DEFAULT 1,                     -- optimistic locking for the CMS
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4),
  CHECK (review_status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX questions_pub_idx    ON questions (grade, skill, topic_id, difficulty) WHERE review_status = 'published';
CREATE INDEX questions_status_idx ON questions (review_status, updated_at DESC);
CREATE INDEX questions_passage_idx ON questions (passage_id) WHERE passage_id IS NOT NULL;
CREATE INDEX questions_source_idx ON questions (source_id);
CREATE INDEX questions_stem_trgm  ON questions USING gin (stem_norm gin_trgm_ops);

CREATE TABLE question_revisions (          -- every CMS edit/status change keeps the previous snapshot
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version     int NOT NULL,
  snapshot    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, version)
);

CREATE TABLE tests (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          text NOT NULL UNIQUE,                       -- lop-6/ngu-phap/thi-hien-tai-don/de-1 | thi-vao-lop-10/de-1
  grade         smallint NOT NULL CHECK (grade BETWEEN 6 AND 9),
  skill         text CHECK (skill IN ('doc-hieu','ngu-phap','tu-vung','viet-cau')),
  topic_id      bigint REFERENCES topics(id),
  kind          text NOT NULL CHECK (kind IN ('topic','mixed','entrance10')),
  title         text NOT NULL,
  seed          text NOT NULL,
  review_status text NOT NULL DEFAULT 'draft'
                CHECK (review_status IN ('draft','in_review','published','archived')),
  published_at  timestamptz,
  version       int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'entrance10') = (skill IS NULL AND topic_id IS NULL))
);
CREATE INDEX tests_pub_idx ON tests (grade, skill, topic_id) WHERE review_status = 'published';

CREATE TABLE test_items (
  test_id      bigint NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  position     smallint NOT NULL,
  question_id  bigint NOT NULL REFERENCES questions(id),
  option_order char(4) NOT NULL CHECK (option_order ~ '^[ABCD]{4}$'),  -- permutation applied to original options
  PRIMARY KEY (test_id, position),
  UNIQUE (test_id, question_id)
);
CREATE INDEX test_items_question_idx ON test_items (question_id);

CREATE TABLE mixer_presets (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  grade      smallint NOT NULL CHECK (grade BETWEEN 6 AND 9),
  skill      text,
  config     jsonb NOT NULL,             -- {size, difficultyMix, skillMix, maxGroup}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- crawl ----------
CREATE TABLE raw_documents (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id    bigint NOT NULL REFERENCES sources(id),
  url          text NOT NULL UNIQUE,
  content_hash text NOT NULL,
  storage_path text NOT NULL,            -- file on the crawler volume, never a blob in the DB
  status       text NOT NULL CHECK (status IN ('fetched','parsed','failed','skipped')),
  fetched_at   timestamptz NOT NULL
);

CREATE TABLE crawl_jobs (                -- also the work queue (FOR UPDATE SKIP LOCKED)
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       bigint NOT NULL REFERENCES sources(id),
  params          jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  run_after       timestamptz NOT NULL DEFAULT now(),
  attempts        smallint NOT NULL DEFAULT 0,
  locked_by       text,
  heartbeat_at    timestamptz,
  started_at      timestamptz,
  finished_at     timestamptz,
  fetched_count   int NOT NULL DEFAULT 0,
  quarantined_count int NOT NULL DEFAULT 0,
  error_count     int NOT NULL DEFAULT 0,
  requested_by    bigint,                -- admin_users.id
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crawl_jobs_queue_idx ON crawl_jobs (run_after) WHERE status = 'queued';

CREATE TABLE crawl_errors (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crawl_job_id bigint NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  url          text, kind text NOT NULL, message text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- public feedback ----------
CREATE TABLE question_reports (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id  bigint NOT NULL REFERENCES questions(id),
  reason       text NOT NULL CHECK (reason IN ('wrong_answer','typo','unclear','offensive','other')),
  note         text CHECK (char_length(note) <= 500),
  client_hash  text NOT NULL,            -- HMAC(ip + ua, rotating salt); never the raw IP
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  handled_at   timestamptz, handled_note text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_reports_open_idx ON question_reports (question_id) WHERE status = 'open';

-- ---------- admin (single owner) ----------
CREATE TABLE admin_users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,           -- argon2id
  totp_secret_enc text,                  -- optional TOTP, encrypted with an app key (not in DB)
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
-- exactly one owner row: enforced by a unique constant expression index
CREATE UNIQUE INDEX admin_users_single ON admin_users ((true));

CREATE TABLE admin_sessions (
  id            text PRIMARY KEY,        -- sha256(session token); cookie holds the raw random token
  admin_user_id bigint NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  csrf_secret   text NOT NULL,
  ip_hash       text, user_agent_hash text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz
);
CREATE INDEX admin_sessions_exp_idx ON admin_sessions (expires_at);

CREATE TABLE login_attempts (            -- rate limit without Redis
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key_hash   text NOT NULL,              -- HMAC(ip) or HMAC(email)
  success    boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_idx ON login_attempts (key_hash, created_at DESC);

CREATE TABLE audit_log (                 -- append-only
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id bigint REFERENCES admin_users(id),
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     text,
  details       jsonb,
  ip_hash       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_idx ON audit_log (created_at DESC);

CREATE TABLE outbox_events (             -- publish -> web revalidation (transactional outbox)
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind         text NOT NULL,            -- revalidate_paths | rebuild
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  attempts     smallint NOT NULL DEFAULT 0
);
CREATE INDEX outbox_pending_idx ON outbox_events (id) WHERE delivered_at IS NULL;

CREATE TRIGGER q_touch BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION bj_touch();
CREATE TRIGGER p_touch BEFORE UPDATE ON passages FOR EACH ROW EXECUTE FUNCTION bj_touch();
CREATE TRIGGER t_touch BEFORE UPDATE ON tests FOR EACH ROW EXECUTE FUNCTION bj_touch();
