#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
exec "$HOME/.local/bin/heavy" -- node render.mjs "$@"
