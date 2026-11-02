-- Up Migration
CREATE TABLE consents (                             -- evidence of consent per purpose (Law 91/2025 art. 9)
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id    uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id     bigint REFERENCES profiles(id) ON DELETE CASCADE,
  purpose        text NOT NULL CHECK (purpose IN ('account', 'child_progress', 'parent_email_notice')),
  policy_version text NOT NULL,
  text_hash      text NOT NULL,                       -- sha256 of the exact consent text shown
  given_at       timestamptz NOT NULL DEFAULT now(),
  withdrawn_at   timestamptz,
  ip_hash        text
);
CREATE INDEX consents_user_id_idx ON consents (user_id);
CREATE INDEX consents_profile_id_idx ON consents (profile_id);

-- Down Migration
DROP TABLE consents;
