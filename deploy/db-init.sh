#!/bin/sh
# Creates (or updates the passwords of) the login roles used by the api and the web.
# Runs inside the postgres:16-alpine image as a one-shot compose service; reads secrets from files.
# Idempotent. Needs migration 0019 first (it creates the NOLOGIN group roles bj_api and bj_web).
set -eu
umask 077
cp /run/secrets/pgpass_superuser /tmp/pgpass
export PGPASSFILE=/tmp/pgpass

psql -v ON_ERROR_STOP=1 --no-psqlrc <<'SQL'
\set api_pw `cat /run/secrets/pg_api`
\set web_pw `cat /run/secrets/pg_web`
SELECT format('CREATE ROLE %I LOGIN', r) FROM unnest(ARRAY['bj_api_login', 'bj_web_login']) AS r
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r)
\gexec
ALTER ROLE bj_api_login PASSWORD :'api_pw';
ALTER ROLE bj_web_login PASSWORD :'web_pw';
GRANT bj_api TO bj_api_login;
GRANT bj_web TO bj_web_login;
ALTER ROLE bj_api_login CONNECTION LIMIT 12;
ALTER ROLE bj_web_login CONNECTION LIMIT 8;
SQL
echo "login roles ready"
