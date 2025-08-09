#!/usr/bin/env bash
set -euo pipefail

URL=${1:-}
OUT_DIR=${2:-docs/qa}

if [[ -z "$URL" ]]; then
  echo "Usage: $0 <url> [out-dir]" >&2
  exit 2
fi

mkdir -p "$OUT_DIR"

# Requires Chrome and npx to be available
npx --yes lighthouse "$URL" \
  --preset=desktop \
  --output=html \
  --output-path="$OUT_DIR/lighthouse-report.html" \
  --only-categories=performance,accessibility,best-practices,seo \
  --throttling.cpuSlowdownMultiplier=1 \
  --emulated-form-factor=desktop \
  --skip-audits=uses-http2

echo "Wrote $OUT_DIR/lighthouse-report.html"


