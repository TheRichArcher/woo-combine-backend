#!/usr/bin/env bash
set -euo pipefail

# Helper wrapper to run automated parts of acceptance

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPTS_DIR="$ROOT_DIR/scripts/testing"

echo "=== Rate Limit Test ==="
TOKEN=${TOKEN:-} RATE_LIMIT_TARGET=${RATE_LIMIT_TARGET:-https://woo-combine-backend.onrender.com/api/users/me} \
  bash "$SCRIPTS_DIR/rate_limit_test.sh" || true

echo "=== Security: Unverified Write ==="
TOKEN=${UNVERIFIED_TOKEN:-} bash "$SCRIPTS_DIR/security_checks.sh" unverified_write || true

if [[ -n "${EVENT_ID_CROSS:-}" ]]; then
  echo "=== Security: Cross-League Read ==="
  TOKEN=${TOKEN:-} EVENT_ID=${EVENT_ID_CROSS:-} bash "$SCRIPTS_DIR/security_checks.sh" cross_league_read || true
fi

echo "Done. Capture logs and screenshots for manual flows per template in docs/testing."

