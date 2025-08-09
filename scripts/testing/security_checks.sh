#!/usr/bin/env bash
set -euo pipefail

# Usage:
# 1) Unverified write block: TOKEN=<id_token_unverified> ./security_checks.sh unverified_write
# 2) Cross-league read: TOKEN=<id_token> EVENT_ID=<other_league_event_id> ./security_checks.sh cross_league_read

BASE="${BACKEND_BASE:-https://woo-combine-backend.onrender.com}"
AUTH_HEADER="Authorization: Bearer ${TOKEN:-}"

cmd=${1:-}
case "$cmd" in
  unverified_write)
    if [[ -z "${TOKEN:-}" ]]; then echo "Set TOKEN"; exit 1; fi
    echo "Attempting role-gated write as unverified user (expect 403)..."
    CODE=$(curl -s -o >(cat >/dev/null) -w "%{http_code}" -H "$AUTH_HEADER" -H 'Content-Type: application/json' \
      -d '{"name":"Sec Test League"}' "$BASE/api/leagues") || true
    echo "HTTP $CODE"
    ;;
  cross_league_read)
    if [[ -z "${TOKEN:-}" || -z "${EVENT_ID:-}" ]]; then echo "Set TOKEN and EVENT_ID"; exit 1; fi
    echo "Fetching players from event not in user leagues (expect 403/404 per rules)..."
    CODE=$(curl -s -o >(cat >/dev/null) -w "%{http_code}" -H "$AUTH_HEADER" "$BASE/api/players?event_id=${EVENT_ID}") || true
    echo "HTTP $CODE"
    if [[ "$CODE" == "200" ]]; then
      echo "WARNING: Cross-league read returned 200. File a security defect." >&2
      exit 2
    fi
    ;;
  *)
    echo "Usage: $0 {unverified_write|cross_league_read}" >&2
    exit 1
    ;;
esac

