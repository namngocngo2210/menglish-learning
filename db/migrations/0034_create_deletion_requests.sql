-- Up Migration
CREATE TABLE deletion_requests (                    -- proof of timely deletion; survives the deleted rows, holds no personal data
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_ref     text NOT NULL,                         -- HMAC of the user id, never the id or email
  scope        text NOT NULL CHECK (scope IN ('profile', 'account')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  due_at       timestamptz NOT NULL,
  done_at      timestamptz
);
CREATE INDEX deletion_requests_user_ref_idx ON deletion_requests (user_ref);

-- Down Migration
DROP TABLE deletion_requests;
