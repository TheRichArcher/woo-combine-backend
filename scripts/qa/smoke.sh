#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${STAGING_BASE_URL:-}
TOKEN=${STAGING_BEARER_TOKEN:-}
OUT="docs/qa/smoke-run-latest.md"

if [[ -z "$BASE_URL" || -z "$TOKEN" ]]; then
  echo "STAGING_BASE_URL and STAGING_BEARER_TOKEN required" >&2
  exit 1
fi

auth() {
  curl -sS -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/users/me" | jq -r '.id' >/dev/null
}

league_id=""
event_id=""

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

pass=()
fail=()

step() { echo "- [$1] $2" >> "$OUT"; }

echo "### Staging Critical Flows Smoke Test" > "$OUT"
echo "Timestamp: $(ts)" >> "$OUT"
echo "Base: $BASE_URL" >> "$OUT"
echo >> "$OUT"

echo "## Steps" >> "$OUT"

if auth; then pass+=("auth"); step x "Auth/me OK"; else fail+=("auth"); step ' ' "Auth/me FAIL"; fi

# Create league
lr=$(curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"QA League"}' "$BASE_URL/api/leagues") || true
league_id=$(echo "$lr" | jq -r '.league_id // empty')
if [[ -n "$league_id" ]]; then pass+=("league"); step x "League created: $league_id"; else fail+=("league"); step ' ' "League create FAIL: $lr"; fi

# Create event
er=$(curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"QA Event","date":null,"location":""}' "$BASE_URL/api/leagues/$league_id/events") || true
event_id=$(echo "$er" | jq -r '.event_id // empty')
if [[ -n "$event_id" ]]; then pass+=("event"); step x "Event created: $event_id"; else fail+=("event"); step ' ' "Event create FAIL: $er"; fi

# CSV import (2 rows)
payload=$(cat <<JSON
{"event_id":"$event_id","players":[{"first_name":"A","last_name":"B","jersey_number":11},{"first_name":"C","last_name":"D","jersey_number":22}]}
JSON
)
ur=$(curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "$payload" "$BASE_URL/api/players/upload") || true
if echo "$ur" | jq -e '.added >= 1' >/dev/null 2>&1; then pass+=("upload"); step x "Upload OK"; else fail+=("upload"); step ' ' "Upload FAIL: $ur"; fi

# Live entry (create a drill result)
pr=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/players?event_id=$event_id") || true
pid=$(echo "$pr" | jq -r '.[0].id // empty')
dr=$(curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"player_id\":\"$pid\",\"type\":\"agility\",\"value\":10,\"event_id\":\"$event_id\"}" \
  "$BASE_URL/api/drill-results/") || true
if echo "$dr" | jq -e '.id' >/dev/null 2>&1; then pass+=("entry"); step x "Live entry OK"; else fail+=("entry"); step ' ' "Live entry FAIL: $dr"; fi

# Standings (rankings)
rk=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/rankings?event_id=$event_id&age_group=&weight_40m_dash=0.3&weight_vertical_jump=0.2&weight_catching=0.15&weight_throwing=0.15&weight_agility=0.2") || true
if echo "$rk" | jq -e 'type=="array"' >/dev/null 2>&1; then pass+=("rankings"); step x "Rankings OK"; else fail+=("rankings"); step ' ' "Rankings FAIL: $rk"; fi

echo >> "$OUT"
echo "## Result" >> "$OUT"
if [[ ${#fail[@]} -eq 0 ]]; then echo "PASS" >> "$OUT"; else echo "FAIL: ${fail[*]}" >> "$OUT"; fi
echo "Completed: $(ts)" >> "$OUT"

echo "Wrote $OUT"



