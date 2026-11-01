-- Up Migration
CREATE TABLE login_attempts (                         -- rate limit without Redis
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key_hash   text NOT NULL,                           -- HMAC(ip) or HMAC(email); never raw values
  success    boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_key_idx ON login_attempts (key_hash, created_at DESC);

-- Down Migration
DROP TABLE login_attempts;
