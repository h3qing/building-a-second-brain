# Vault Template

This folder is a **starter Obsidian vault** wired for the Building a Second Brain pipeline. Copy it, open it in Obsidian, point Claude Code at it, and start ingesting.

## What's in here

```
CLAUDE.md                  The pipeline. Claude Code loads this every session.
ISA.md                     Design + setup for the GitHub auto-sync layer.
sync.sh                    Ready-to-use sync script (edit the Variables block).
.gitignore                 Keeps secrets out of the synced repo.
.claude/skills/
  capture-knowledge/       The /capture-knowledge skill: the whole ingest pipeline
                           as a one-shot command, with battle-tested fallbacks
                           (paywalled articles, YouTube transcripts, broken sync).
00 Meta/
  schema.md                Frontmatter + naming conventions.
  index.md                 The map of your wiki (LLM keeps it current).
  log.md                   Append-only operation log (feeds the web app's homepage).
  review-queue.md          Dataview dashboard for spaced-repetition review.
  extraction-tracker.md    Backlog of sources to extract from.
  Template/                Obsidian note templates (Source / Idea / Concept / Person).
10 Notes/   20 Ideas/   30 Concept/   40 Write/   50 People/   Inbox/
                           The pipeline stages + quick capture (empty, with hints).
```

## Quick start

1. **Copy this folder** somewhere outside the app repo and open it as an Obsidian vault.
2. **Install Obsidian plugins:** *Dataview* (powers `review-queue.md`) and optionally *Templater*. The Kindle plugin if you import book highlights.
3. **Customize `CLAUDE.md`:** edit the **Topic Vocabulary** and folder lists to your own domains. Everything else is ready.
4. **Set up sync** (so the web app can read your vault): create a **private** GitHub repo, then follow `ISA.md` — edit `sync.sh`'s Variables block, install it, and schedule it.
5. **Start ingesting:** open Claude Code in the vault and paste a URL, drop a file in `Inbox/`, or say "extract Atomic Habits" — or run `/capture-knowledge <url>` (the skill ships with the template in `.claude/skills/`). Claude runs the pipeline: source → atomic ideas → concepts → people. Everything lands as `review_status: unreviewed`.
6. **Review:** open `review-queue.md` in Obsidian (or the private `/review` page in the web app) and approve what you've internalized. Approved ideas enter spaced repetition.
7. **Publish:** point the web app (the parent repo) at your vault repo via `.env.local` and deploy. Your public knowledge graph goes live.

The human is the bottleneck on purpose — AI extracts, you review, knowledge compounds.
