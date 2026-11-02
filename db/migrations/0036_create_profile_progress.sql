-- Up Migration
CREATE TABLE profile_progress (                    -- best/last score per test, imported from the child's local browser progress
  profile_id bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_slug  text NOT NULL CHECK (char_length(test_slug) BETWEEN 1 AND 200),
  best       integer NOT NULL CHECK (best >= 0),
  last       integer NOT NULL CHECK (last >= 0),
  total      integer NOT NULL CHECK (total > 0),
  played_at  timestamptz NOT NULL,
  PRIMARY KEY (profile_id, test_slug),
  CHECK (last <= total AND best >= last AND best <= total)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON profile_progress TO bj_api;

-- Down Migration
DROP TABLE profile_progress;
