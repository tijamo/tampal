#!/bin/bash
set -euo pipefail

# Only touch git state for fresh sessions on Claude Code on the web —
# never on resume/clear/compact, and never on a local machine where a
# forced checkout could clobber someone's own WIP.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

input="$(cat)"
source="$(echo "$input" | jq -r '.source // empty')"
if [ "$source" != "startup" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

git fetch origin main --quiet

# Only reset to main if the tree is clean — never discard uncommitted work.
if git diff --quiet && git diff --cached --quiet; then
  git checkout main --quiet 2>/dev/null || git checkout -b main origin/main --quiet
  git reset --hard origin/main --quiet
fi

# Drop remote-tracking refs for branches deleted on the remote (e.g. merged PRs).
git remote prune origin

# Trim local branches whose upstream is gone — they're stale by definition.
current_branch="$(git branch --show-current)"
git for-each-ref --format '%(refname:short) %(upstream:track)' refs/heads/ |
  awk '$2 == "[gone]" { print $1 }' |
  while IFS= read -r branch; do
    if [ "$branch" != "main" ] && [ "$branch" != "$current_branch" ]; then
      git branch -D "$branch" || true
    fi
  done

exit 0
