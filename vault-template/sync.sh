#!/bin/bash
# Auto-sync an Obsidian vault to a (private) GitHub repo via PR.
# Detached git dir: the vault itself has NO .git — git is driven with
# --git-dir / --work-tree, so the vault stays a clean Obsidian folder.
#
# Design contract: the LOCAL WORKING TREE IS ALWAYS SAFE.
# - We commit on main directly (never branch locally, never `checkout` away).
# - We push the new main commit to a remote sync/<timestamp> branch and open a PR.
# - If push or PR creation fails (offline, no gh, etc.), the commit is still on
#   local main; the next run will push again with no data loss.
# - You review and merge each PR — that's the audit trail.

# ── Variables — EDIT THESE ────────────────────────────────────────────────────
REPO_PATH="$HOME/code/second-brain"            # where the .git dir lives (NOT inside the vault)
VAULT_PATH="$HOME/Documents/Obsidian Vault"    # your Obsidian vault (the work tree)
GH_REPO="your-username/your-vault-repo"        # private GitHub repo, owner/name
# Top-level folders to name in commit messages:
FOLDERS=("00 Meta" "10 Notes" "20 Ideas" "30 Concept" "40 Write" "Inbox")
# ──────────────────────────────────────────────────────────────────────────────

LOG="$REPO_PATH/.sync.log"
GIT_DIR="$REPO_PATH/.git"
WORK_TREE="$VAULT_PATH"

# cron/launchd strip PATH down to /usr/bin:/bin — Homebrew binaries (gh, git)
# live elsewhere. Restore a typical interactive PATH so `gh` resolves.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# `gh`'s token lives in the macOS login keychain, which cron/launchd CANNOT unlock
# headlessly — so `gh pr create` fails even though SSH `git push` succeeds. Load a
# token (repo scope) from a 0600 file so gh can authenticate without the keychain.
# Create it once with:  mkdir -p ~/.config/secondbrain && gh auth token > ~/.config/secondbrain/gh-token && chmod 600 ~/.config/secondbrain/gh-token
# (or paste a classic PAT with `repo` scope — more durable, won't rotate).
GH_TOKEN_FILE="$HOME/.config/secondbrain/gh-token"
if [ -z "$GH_TOKEN" ] && [ -f "$GH_TOKEN_FILE" ]; then
  export GH_TOKEN="$(tr -d '[:space:]' < "$GH_TOKEN_FILE")"
fi

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG"; }
g()   { git --git-dir="$GIT_DIR" --work-tree="$WORK_TREE" "$@"; }

# A manual git op is in flight — don't race it.
[ -f "$GIT_DIR/index.lock" ] && { log "SKIP: index.lock exists"; exit 0; }

cd /tmp 2>/dev/null

# Refuse to operate unless we're on main (don't commit onto a stray sync branch).
CURRENT_BRANCH=$(g rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$CURRENT_BRANCH" != "main" ]; then
  log "SKIP: HEAD is on '$CURRENT_BRANCH', not main — manual intervention needed"
  exit 0
fi

g add -A 2>> "$LOG"
g diff --cached --quiet && exit 0   # nothing to commit → no empty branch/PR

CHANGED=$(g diff --cached --name-only | head -20)
FILE_COUNT=$(g diff --cached --name-only | wc -l | tr -d ' ')
SUMMARY=""
for f in "${FOLDERS[@]}"; do
  echo "$CHANGED" | grep -q "$f/" && SUMMARY="$SUMMARY ${f##* },"
done
SUMMARY=$(echo "$SUMMARY" | sed 's/,$//' | sed 's/^ //')
[ -z "$SUMMARY" ] && SUMMARY="vault files"

# Commit on local main. From here the change is durable on disk.
g commit -m "sync: update $SUMMARY ($FILE_COUNT files)" 2>> "$LOG" \
  || { log "ERROR: commit failed"; exit 1; }

COMMIT_SHA=$(g rev-parse HEAD)
BRANCH="sync/$(date '+%Y-%m-%d-%H%M')"

# Push the commit to a NEW remote branch without moving local refs.
g push origin "HEAD:refs/heads/$BRANCH" 2>> "$LOG"
if [ $? -ne 0 ]; then
  log "WARN: push failed — commit $COMMIT_SHA is safe on local main, will retry next cycle"
  g push origin main 2>> "$LOG" || true
  exit 0
fi

command -v gh >/dev/null 2>&1 || { log "WARN: gh not on PATH — branch $BRANCH pushed without PR"; exit 0; }

PR_URL=$(gh pr create --repo "$GH_REPO" --head "$BRANCH" --base main \
  --title "sync: update $SUMMARY ($FILE_COUNT files)" \
  --body "Auto-sync $(date '+%Y-%m-%d %H:%M'). Local main is at \`$COMMIT_SHA\`; merging fast-forwards remote main." 2>> "$LOG")

if [ $? -eq 0 ]; then
  log "OK: PR created — $PR_URL"
  osascript -e "display notification \"$PR_URL\" with title \"Second Brain Sync\" subtitle \"$FILE_COUNT files\"" 2>/dev/null
else
  log "WARN: PR creation failed — branch $BRANCH pushed, open PR manually"
fi
log "OK: synced $FILE_COUNT files to $BRANCH (local main at $COMMIT_SHA)"
