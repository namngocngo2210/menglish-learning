-- Up Migration
CREATE TABLE identities (                           -- linked external logins; keyed by `sub`, never by email
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      text NOT NULL CHECK (provider IN ('google')),
  subject       text NOT NULL,
  email_at_link text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject)
);
CREATE INDEX identities_user_id_idx ON identities (user_id);

-- Down Migration
DROP TABLE identities;
