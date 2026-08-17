---
name: capture-knowledge
description: >-
  Ingest a source into the second-brain Obsidian vault: capture full text →
  extract atomic ideas → synthesize concepts → update people pages → update
  index/log → open a sync PR. Use when given a URL, article, podcast/video link,
  or pasted text to "save", "capture", "ingest", "add to my second brain", or
  when asked to "process the inbox". The vault's own CLAUDE.md is the authority;
  this skill operationalizes it and carries the hard-won fallbacks (paywall
  fetch, broken-sync side-branch PR).
---

# Capture Knowledge → Second Brain

Run the vault's ingest pipeline end-to-end. A pasted URL/text **with no other
instruction means "ingest it"** — detect the type and run; don't ask "what should I
do with this?".

## Layout (read this first)

- The vault may be a plain git repo, or (recommended, per `ISA.md`) a **detached
  work tree**: the `.git` dir lives in a separate `REPO_PATH`, the vault folder is
  the work tree, and `sync.sh`'s Variables block defines both. In that setup, drive
  git with `git --git-dir="$REPO_PATH/.git" --work-tree="$VAULT_PATH" …`.
- Authoritative schema: the vault's `CLAUDE.md`. Re-read it if unsure; it can drift
  from this skill.

## Folder structure

```
10 Notes/<type>/   Raw sources (IMMUTABLE after capture): Articles, Podcasts, Videos,
                   Conversations, Courses, Personal, Kindle Notes
20 Ideas/<type>/   Atomic ideas, one per file, in a per-source subfolder
30 Concept/        Flat. Lean cross-source hub nodes
50 People/         Flat. Lean person hub nodes (authors, hosts, guests)
00 Meta/           index.md, log.md, review-queue.md (Dataview), schema.md, Template/
```

`<type>` ∈ article | book | podcast | conversation | course | video | personal.

## Pipeline

### 1. CAPTURE — get the COMPLETE source text (never summarize at this stage)
- **Article/blog URL**: try WebFetch for full markdown. If it fails (Substack and
  many sites block it), fall back to a reader proxy:
  `curl -sL --max-time 60 "https://r.jina.ai/<URL>" -o <scratchpad>/raw.md`. Note the
  capture method + any truncation in the source note.
- **YouTube**: `yt-dlp --write-auto-subs --skip-download --sub-lang en <URL>` for the
  transcript. If yt-dlp is missing, WebFetch the page and flag transcript incomplete.
- **Podcast (non-YouTube)**: follow [`docs/podcast-index.md`](../../docs/podcast-index.md) —
  Podcast Index to resolve feed/episode and fetch `transcriptUrl` or RSS
  `<podcast:transcript>`. **No transcript → no Ideas**; note the gap, do not invent.
  Fallback: WebFetch show notes/metadata only.
- **Pasted text**: use verbatim — the human's words ARE the source; set `origin: human`.
- **Inbox file**: read it, infer type, triage.

### 2. SOURCE — write `10 Notes/<type>/{Title} - {Author}.md`
Full text/transcript as the body. Frontmatter:
```yaml
---
source_type: article
title: "..."
author: "..."
date_ingested: <today YYYY-MM-DD>
url: "..."
status: raw
tags: [...]            # lowercase descriptors + person/org
---
```
Add a `> [!note] Source note` callout recording capture method/date and any gaps.
Preserve footnotes, inline links, even sponsor reads (fidelity > tidiness).
After extraction, flip `status: raw` → `integrated`.

### 3. EXTRACT — atomic ideas → `20 Ideas/<type>/{Source Title}/<idea-slug>.md`
Extract as many distinct ideas as the source genuinely warrants — no quota, no cap.
Each must be a distinct, transferable insight worth reviewing on its own. **Present
the proposed idea list to the human for a thumbs-up BEFORE writing the files**,
unless they said batch/just-do-it.
Each idea file:
```yaml
---
source: "[[{Source filename without path/ext}]]"
source_type: article
source_date: <source's publish/record date — anchors retro-verification>
origin: ai-generated
review_status: unreviewed        # ALWAYS unreviewed; only the human sets reviewed
reviewed_date:
review_count: 0
review_interval: 1
next_review_date:
difficulty:
tags: [Topic1, Topic2, descriptor, person-or-org]
---

# Idea Title

## Insight
1-2 sentences, in context of the argument. No generic summaries. No em-dashes.

## Source Context
> exact quote/blockquote from the source
> (podcasts: add `[MM:SS](youtube_url&t=seconds)`; books: `![[Book - Author#^ref-XXXXX]]`)

## Related Concepts
[[concept-a]] | [[concept-b]] | [[concept-c]]
```
**Tag convention**: first 1-2 tags are capitalized Topic labels from the vault
CLAUDE.md's controlled Topic Vocabulary (extend conservatively). Remaining tags are
lowercase-hyphenated descriptors. **Always** add primary person(s)/org as kebab-case
tags (e.g. `james-clear`) so people/companies become filterable nodes.

### 4. SYNTHESIZE — `30 Concept/`
Reuse existing concepts (list the folder first; normalize/merge duplicates). Create a
new concept page only when needed, in the **lean** format:
```yaml
---
origin: ai-generated
review_status: unreviewed
reviewed_date:
last_updated: <today>
source_count: 1
tags: [Topic, ...]
---

# Concept Name

One-sentence definition.

## Tensions
2-3 sentences where sources disagree. Only if genuinely interesting.

## Related Concepts
[[a]] | [[b]] | [[c]]
```
No "Key Insights"/"Open Questions" lists — Obsidian backlinks surface the ideas. Keep
concept pages under ~20 lines.

### 5. PEOPLE — `50 People/`
For each author, host, and guest of the source, create or update a lean person page
(see the Person notes spec in the vault CLAUDE.md): one-line identity, 2-4 sentence
bio, `## In the Vault` link to this source, `## Related People` wired both ways
(host ↔ guest, same-cluster authors), `## Related Concepts`. Filename = common name;
non-Latin names get a romanization in `aliases`. Always `review_status: unreviewed`.

### 6. LOG + INDEX
- Prepend a dated entry to `00 Meta/log.md` (newest at top): source, capture method,
  ideas created, new/linked concepts and people, source_date, item count.
- Update `00 Meta/index.md` — add the source under both `## Sources` and `## Ideas`,
  bump the concepts blurb.
- **`00 Meta/review-queue.md` is pure Dataview — do NOT edit it.** It auto-counts the
  new `unreviewed` items.

### 7. NOTIFY
Tell the human how many items hit the review queue and to check
`00 Meta/review-queue.md` in Obsidian (or the web app's private `/review` page).

### 8. COMMIT — open a sync PR
First try the normal path: `bash $REPO_PATH/sync.sh` (stages the vault, commits on
`main`, pushes a `sync/<ts>` branch, opens a PR on your private vault repo).

**If `sync.sh` fails** (check `$REPO_PATH/.sync.log`): the common cause is a dirty
work tree (uncommitted `40 Write/` WIP) blocking its rebase, and/or local `main` far
behind `origin/main`. Don't force-resolve the user's repo. Instead ship JUST this
ingest on a clean side-branch off origin, leaving their WIP untouched:
1. `git --git-dir=$REPO_PATH/.git worktree add -b sync/<ts>-<slug> <scratchpad>/wt origin/main`
2. Copy the new source/idea/concept/people files into the worktree at the same paths.
3. Re-apply the `index.md`/`log.md` edits onto the worktree's (origin) versions.
4. `git add` only the intended paths, commit (`sync: ingest …`), push, `gh pr create`.
5. `git --git-dir=… worktree remove --force <scratchpad>/wt`.
Then report the broken cron so the user fixes it (commit/stash their WIP).

## Golden rules
- NEVER modify `10 Notes/` after capture, or any Kindle frontmatter.
- ALL AI-generated content is `review_status: unreviewed`. Only the human marks reviewed.
- Every file gets correct frontmatter. Use `[[wikilinks]]` liberally.
- Don't reorganize/rename existing files. No emojis unless asked.
- Surgical: touch only what the ingest requires.

## Commit message
`sync: ingest <type> — <short title> (N ideas, M concepts)`
