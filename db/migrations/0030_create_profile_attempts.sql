-- Up Migration
CREATE TABLE profile_attempts (                     -- links a client-side attempt id to a profile; answers are not stored here
  profile_id bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attempt_id text NOT NULL CHECK (char_length(attempt_id) BETWEEN 8 AND 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, attempt_id)
);

-- Down Migration
DROP TABLE profile_attempts;
