#!/usr/bin/env bash
# Run ONCE by the owner on the host: generates the secret files used by deploy/compose.yml.
#   bash deploy/gen-secrets.sh [target-dir]        (default: ~/beejunior-secrets)
# Values come from `openssl rand`; nothing is printed. Existing files are never overwritten, so a
# second run only adds what is missing. Agents never read this directory (decision D7).
set -euo pipefail

dir="${1:-$HOME/beejunior-secrets}"
umask 077
mkdir -p "$dir"
chmod 700 "$dir"

put() { # put <name> <value>
  local file="$dir/$1"
  if [ -e "$file" ]; then echo "keep   $1"; return; fi
  printf '%s' "$2" > "$file"
  chmod 600 "$file"
  echo "create $1"
}
rand() { openssl rand -hex 24; }

pg_superuser="$(rand)"; pg_api="$(rand)"; pg_web="$(rand)"
# Reuse existing passwords when only some files are missing, so URLs stay consistent with them.
[ -e "$dir/pg_superuser" ] && pg_superuser="$(cat "$dir/pg_superuser")"
[ -e "$dir/pg_api" ] && pg_api="$(cat "$dir/pg_api")"
[ -e "$dir/pg_web" ] && pg_web="$(cat "$dir/pg_web")"

put pg_superuser "$pg_superuser"
put pg_api "$pg_api"
put pg_web "$pg_web"
# .pgpass format for the one-shot db-init service (host:port:db:user:password).
put pgpass_superuser "postgres:5432:beejunior:postgres:$pg_superuser"
put db_url_superuser "postgres://postgres:$pg_superuser@postgres:5432/beejunior"
put db_url_api "postgres://bj_api_login:$pg_api@postgres:5432/beejunior"
put db_url_web "postgres://bj_web_login:$pg_web@postgres:5432/beejunior"
put internal_token "$(rand)"

echo "done: $dir (mode 700, files 600). Do not copy these files into chat, the repo or logs."
