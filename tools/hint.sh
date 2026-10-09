#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS="${DP_PASSPHRASE:-debug-me}"

usage() {
  cat <<'USAGE'
Usage: npm run hint <bug> <level>

  bug    1-5   which defect you are stuck on
  level  1-3   1 = symptom, and step-by-step how to reproduce it
               2 = subsystem / where to look
               3 = root cause and file

Every level tells you how to reproduce the defect, so you can always
see it happen for yourself before you start looking for the cause.
Level 1 says nothing about what is causing it.

Each hint is decrypted on its own, so asking for help with one defect
never reveals anything about the others.

Examples:
  npm run hint 2 1
  npm run hint 2 2
  npm run hint 4 3
USAGE
}

if [[ $# -lt 2 ]]; then
  usage
  exit 0
fi

BUG="$1"
LEVEL="$2"

if ! [[ "$BUG" =~ ^[1-5]$ ]]; then
  echo "error: bug must be 1-5 (got '$BUG')" >&2
  exit 1
fi

if ! [[ "$LEVEL" =~ ^[1-3]$ ]]; then
  echo "error: level must be 1-3 (got '$LEVEL')" >&2
  exit 1
fi

BLOB="$ROOT/hints/$BUG.$LEVEL.enc"

if [[ ! -f "$BLOB" ]]; then
  echo "error: no hint file at $BLOB" >&2
  exit 1
fi

echo
echo "--- defect $BUG, hint level $LEVEL ---"
echo
openssl enc -d -aes-256-cbc -pbkdf2 -salt -pass "pass:$PASS" -in "$BLOB"
echo
