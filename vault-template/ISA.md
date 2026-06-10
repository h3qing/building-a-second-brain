# ISA — Obsidian Vault → GitHub auto-sync

The design spec for the sync layer. The ready-to-use implementation is **`sync.sh`** (in this folder) — edit its `Variables` block and install it. This file explains *why* it's built the way it is, and how to wire it up.

## Variables (set these in `sync.sh`)

- `VAULT_PATH` — your Obsidian vault, e.g. `~/Documents/Obsidian Vault`
- `REPO_PATH`  — where the `.git` dir lives, **separate** from the vault, e.g. `~/code/second-brain`
- `GH_REPO`    — `username/repo` (must be **private**)
- `FOLDERS`    — top-level vault folders to detect in commit messages

## Design principles (non-negotiable)

1. **Detached git dir.** The vault has no `.git`. Drive git with `--git-dir=$REPO_PATH/.git --work-tree=$VAULT_PATH`, wrapped in a `g()` helper. The vault stays a clean Obsidian folder.
2. **Never touch local main's checkout.** Commit on `main`, then push that commit to a fresh `sync/YYYY-MM-DD-HHMM` branch via `HEAD:refs/heads/$BRANCH`. The working tree is never at risk. A PR is the review surface; the scheduled job is the only writer; you review and merge.
3. **Bail on lock.** If `$GIT_DIR/index.lock` exists, exit 0 — a manual git op is in flight.
4. **Bail on no-op.** `git diff --cached --quiet` short-circuits empty syncs. No empty commits, branches, or log spam.
5. **Self-summarizing commits.** Diff filenames against `FOLDERS`, emit `sync: update notes, ideas (N files)`. No LLM in the hot path — keep the job deterministic and fast.
6. **Durable on failure.** If push/PR fails (offline, no `gh`), the commit is already safe on local `main`; the next run carries it forward. No rollback needed.
7. **Single append-only log** at `$REPO_PATH/.sync.log`.
8. **OS notification on success** (macOS `osascript`) surfaces the PR URL so you remember to review.

## Setup

1. `git init` at `$REPO_PATH`. Add remote `git@github.com:$GH_REPO.git`. Create an empty `main` and an initial commit of the vault so `main` exists on origin.
2. Copy `sync.sh` to `$REPO_PATH/sync.sh`, edit its `Variables` block, `chmod +x`.
3. **Auth for headless runs** (the part everyone trips on): `gh`'s token lives in the macOS keychain, which cron/launchd can't unlock — so `gh pr create` fails silently in the background while `git push` (SSH) still works. Fix it once:
   ```bash
   mkdir -p ~/.config/secondbrain
   gh auth token > ~/.config/secondbrain/gh-token   # or paste a classic PAT (repo scope) — more durable
   chmod 600 ~/.config/secondbrain/gh-token
   ```
   `sync.sh` loads `GH_TOKEN` from that file automatically.
4. **Schedule it.** Pick ONE scheduler — don't run both:
   - **launchd (macOS, recommended):** a `LaunchAgent` plist with `StartInterval` (e.g. 900s). Fires only while the laptop is awake, and can be triggered on demand for testing: `launchctl kickstart -k gui/$(id -u)/<label>`.
   - **cron:** `7 * * * * /bin/bash $REPO_PATH/sync.sh`
5. **macOS Full Disk Access.** `~/Documents` is TCC-protected. The *program your scheduler runs* (`/bin/bash` for launchd, `/usr/sbin/cron` for cron) needs **Full Disk Access** (System Settings → Privacy & Security), or background runs fail with `Operation not permitted` reading the vault. Foreground runs from Terminal already have it.
6. **Smoke test:** edit one file in the vault, run `bash $REPO_PATH/sync.sh`, confirm exactly one PR appears.

## Security

`git add -A` stages everything in the vault. Therefore:

- The GitHub repo **must be private**.
- Add a vault `.gitignore` for `.env*`, `*.key`, `*.pem`, `secrets/`, `.DS_Store` (a starter is in this folder).
- Don't paste API keys or passwords into notes.

## Acceptance checks

- Editing one file produces exactly one PR.
- A second run while the first is mid-flight exits silently (lock check).
- A no-op run produces no commit, branch, or PR.
- A failed push leaves the commit safe on local `main` with no orphan state.
- The PR title summarizes which top-level folders changed.
