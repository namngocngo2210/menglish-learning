-- Up Migration
CREATE TABLE question_reports (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id  bigint NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  reason       text NOT NULL CHECK (reason IN ('wrong_answer','typo','unclear','offensive','other')),
  note         text CHECK (char_length(note) <= 500),
  client_hash  text NOT NULL,                         -- HMAC(ip + ua, rotating salt); never the raw IP
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  handled_at   timestamptz,
  handled_note text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_reports_question_id_idx ON question_reports (question_id);
CREATE INDEX question_reports_open_idx ON question_reports (created_at) WHERE status = 'open';

-- Down Migration
DROP TABLE question_reports;
