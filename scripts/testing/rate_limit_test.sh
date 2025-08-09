#!/usr/bin/env bash
set -euo pipefail

# Usage: RATE_LIMIT_TARGET="https://woo-combine-backend.onrender.com/api/users/me" TOKEN="<id_token>" ./rate_limit_test.sh

TARGET_URL="${RATE_LIMIT_TARGET:-https://woo-combine-backend.onrender.com/api/users/me}"
AUTH_HEADER="Authorization: Bearer ${TOKEN:-}"
COUNT=${COUNT:-330}

if [[ -z "${TOKEN:-}" ]]; then
  echo "ERROR: Set TOKEN to a valid Firebase ID token" >&2
  exit 1
fi

echo "Hammering ${TARGET_URL} ${COUNT} times to trigger 429..."
HAD_429=0
for i in $(seq 1 "$COUNT"); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_HEADER" "$TARGET_URL") || true
  if [[ "$CODE" == "429" ]]; then HAD_429=1; fi
  if (( i % 25 == 0 )); then echo -n "."; fi
done
echo

echo "Fetching one response body to verify JSON..."
RESP=$(curl -s -H "$AUTH_HEADER" "$TARGET_URL") || true
echo "Sample response: $RESP"

if [[ $HAD_429 -eq 1 ]]; then
  echo "OK: Rate limit triggered (429 observed)."
  exit 0
else
  echo "WARN: 429 not observed; verify RATE_LIMITS_* env or increase COUNT." >&2
  exit 2
fi

