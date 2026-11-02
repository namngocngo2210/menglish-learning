-- Up Migration
CREATE TABLE profiles (                             -- child profiles: nickname and grade only, no other personal data
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname    text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 20),
  grade       smallint NOT NULL CHECK (grade BETWEEN 6 AND 9),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_user_id_idx ON profiles (user_id);

-- Down Migration
DROP TABLE profiles;
