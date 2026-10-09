#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS="${DP_PASSPHRASE:-debug-me}"
BLOB="$ROOT/SOLUTIONS.md.enc"

if [[ ! -f "$BLOB" ]]; then
  echo "error: no answer key at $BLOB" >&2
  exit 1
fi

cat >&2 <<'WARNING'

  This prints the complete write-up for all five defects.
  If you only want help with one, use:  npm run hint <1-5> <1-3>

WARNING

openssl enc -d -aes-256-cbc -pbkdf2 -salt -pass "pass:$PASS" -in "$BLOB"
