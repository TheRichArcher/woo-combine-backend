#!/usr/bin/env bash
set -euo pipefail

# Sync docs/runbooks/*.md into the GitHub Wiki for this repository.
# Requirements:
# - GitHub Wiki enabled on the repo
# - Git configured with access to push to the wiki (HTTPS with credentials or SSH)

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
RUNBOOKS_DIR="$ROOT_DIR/docs/runbooks"

if [[ ! -d "$RUNBOOKS_DIR" ]]; then
  echo "Runbooks directory not found: $RUNBOOKS_DIR" >&2
  exit 1
fi

cd "$ROOT_DIR"

# Determine origin URL and wiki URL
ORIGIN_URL=$(git remote get-url origin)
if [[ -z "$ORIGIN_URL" ]]; then
  echo "Could not determine git origin URL" >&2
  exit 1
fi

if [[ "$ORIGIN_URL" =~ github.com[:/](.+)/(.+)(\.git)?$ ]]; then
  OWNER_REPO="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
else
  echo "Origin does not look like a GitHub URL: $ORIGIN_URL" >&2
  exit 1
fi

OWNER=${OWNER_REPO%%/*}
REPO=${OWNER_REPO##*/}
REPO=${REPO%.git}

WIKI_URL_HTTPS="https://github.com/$OWNER/$REPO.wiki.git"
WIKI_URL_SSH="git@github.com:$OWNER/$REPO.wiki.git"

WIKI_DIR="$ROOT_DIR/${REPO}.wiki"

if [[ ! -d "$WIKI_DIR/.git" ]]; then
  echo "Cloning wiki repo..."
  if git ls-remote "$WIKI_URL_HTTPS" &>/dev/null; then
    git clone "$WIKI_URL_HTTPS" "$WIKI_DIR"
  elif git ls-remote "$WIKI_URL_SSH" &>/dev/null; then
    git clone "$WIKI_URL_SSH" "$WIKI_DIR"
  else
    echo "Wiki repository not found or access denied: $WIKI_URL_HTTPS" >&2
    echo "Enable the GitHub Wiki for $OWNER/$REPO and ensure you have push access, then re-run." >&2
    exit 2
  fi
fi

cd "$WIKI_DIR"

# Copy runbooks into wiki root with readable names
declare -A files=(
  ["$RUNBOOKS_DIR/Credential-Outage.md"]="Credential-Outage.md"
  ["$RUNBOOKS_DIR/Firestore-Quota-Exceeded.md"]="Firestore-Quota-Exceeded.md"
  ["$RUNBOOKS_DIR/Rate-Limit-Tuning.md"]="Rate-Limit-Tuning.md"
  ["$RUNBOOKS_DIR/Incident-Response.md"]="Incident-Response.md"
)

CHANGED=0
for src in "${!files[@]}"; do
  dest="${files[$src]}"
  if [[ -f "$src" ]]; then
    install -m 0644 "$src" "$dest"
    git add "$dest"
    CHANGED=1
  else
    echo "Warning: missing source file $src" >&2
  fi
done

if [[ $CHANGED -eq 1 ]]; then
  git commit -m "docs(runbooks): sync incident runbooks (credentials, firestore quota, rate limit tuning, incident response)"
  git push
  echo "Wiki updated: $WIKI_DIR"
else
  echo "No changes to commit."
fi


