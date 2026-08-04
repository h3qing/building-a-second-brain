# LLM Wiki — Obsidian Vault Pipeline

This vault is a **personal knowledge base** following the [LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). An LLM (Claude Code) maintains a persistent, compounding wiki. The human curates sources, reviews everything, and writes.

> This file is loaded automatically by Claude Code at the start of every session in this vault. It defines the rules, structure, and operations of the pipeline. Edit it to fit your own topics and taste — the **Topic Vocabulary** and folder lists are meant to be customized.

## Golden Rules

1. **NEVER modify files in `10 Notes/`** — raw sources are immutable
2. **NEVER delete or rename existing files** unless explicitly asked
3. **ALL AI-generated content must have `review_status: unreviewed`** — the human reviews everything
4. **Every file you create or update must have correct frontmatter** (see Frontmatter Spec below)
5. **Update `00 Meta/index.md` and `00 Meta/log.md`** after every ingest or significant operation
6. **Use `[[wikilinks]]` extensively** — cross-references are the point of this system

## Vault Structure

```
00 Meta/            Schema layer: index, log, schema, review queue, templates
10 Notes/           Raw sources (IMMUTABLE): books, articles, podcasts, etc.
20 Ideas/           Extracted atomic ideas per source (AI-generated, human-reviewed)
30 Concept/         Cross-source concept synthesis (AI-maintained wiki layer)
40 Write/           Human writing & publishing (human-owned)
Inbox/              Quick capture (messy, low-friction)
```

### Flow: Source → Extract → Synthesize → Write

```
Inbox/ → triage → 10 Notes/<type>/     (raw, immutable)
                      ↓ ingest
                  20 Ideas/<type>/      (atomic ideas, per-source)
                      ↓ synthesize
                  30 Concept/           (cross-source concepts)
                      ↓ write
                  40 Write/             (human voice, publishing)
```

### Source Types in `10 Notes/`

| Subfolder | Content |
|-----------|---------|
| `Kindle Notes/` | Book highlights (e.g. from the Obsidian Kindle plugin) |
| `Articles/` | Web clips, blog posts, papers |
| `Podcasts/` | Episode notes, transcripts |
| `Conversations/` | Meeting notes, 1:1s, discussions |
| `Courses/` | Course material, lectures |
| `Videos/` | Talks, YouTube, tutorials |
| `Personal/` | Journal entries, reflections, raw thinking |

### `20 Ideas/` mirrors source types

Create `20 Ideas/Books/`, `20 Ideas/Articles/`, `20 Ideas/Podcasts/`, etc. as you extract from each type. One idea per file.

### `30 Concept/` is flat (no subfolders)

Concepts are source-agnostic. A concept like `[[negotiation]]` pulls insights from books, articles, conversations — anything.

### `40 Write/` subfolders

| Subfolder | Content |
|-----------|---------|
| `41 Random/` | Writing challenges, freewriting |
| `42 In Progress/` | Drafts |
| `49 Publish/` | Published or ready-to-publish pieces |

## Frontmatter Spec

### Source notes (`10 Notes/`)

```yaml
---
source_type: article | book | podcast | conversation | course | video | personal
title: "..."
author: "..."
date_ingested: YYYY-MM-DD
url: "..."              # if applicable
status: raw | extracted | integrated
tags: []
---
```

Note: Kindle Notes often have their own frontmatter format from the Kindle plugin. Do NOT modify existing Kindle frontmatter. Only apply this format to new non-Kindle sources.

### Idea notes (`20 Ideas/`)

```yaml
---
source: "[[10 Notes/.../Source File]]"
source_type: article | book | podcast | conversation | course | video | personal
source_date:             # YYYY-MM-DD the source was published/recorded — anchors retro verification of time-bound claims
origin: ai-generated | ai-assisted | human
review_status: unreviewed | in-review | reviewed | contested
reviewed_date:          # YYYY-MM-DD, set when reviewed
review_count: 0          # times reviewed (set on first approval)
review_interval: 1       # days until next review
next_review_date:        # YYYY-MM-DD, computed after each review
difficulty:              # easy | medium | hard (set on re-reviews)
tags: []                 # first 1-2 entries are top-level Topic labels (see below)
---
```

#### Tag convention

The **first 1-2 tags** are top-level Topic labels — capitalized, single word, drawn from a small controlled vocabulary so ideas can be filtered/grouped by topic. Remaining tags stay lowercase-hyphenated free-form descriptors.

**Topic Vocabulary** — *customize this to your own domains.* Keep it small and conservative; extend only as genuinely new domains arrive. Example starter set:

- **Psychology** — cognition, habits, motivation, decision-making
- **Productivity** — workflows, prioritization, attention management
- **Strategy** — positioning, competitive moats, market plays
- **Leadership** — management, teams, hiring, culture
- **Philosophy** — ethics, meaning, mental models
- **Health** — fitness, sleep, nutrition, longevity
- **AI** — models, compute, technical roadmaps, AI industry

Example: `tags: [Psychology, Productivity, habit-formation, attention]` — Psychology and Productivity are Topic labels, the rest are descriptors.

Also include the primary **person(s) and org** as kebab-case descriptor tags (e.g. `james-clear`, `penguin-random-house`) so people and companies become first-class, filterable nodes across sources.

#### Spaced Repetition (Leitner)

After first approval: `review_count: 1`, `review_interval: 1`, `next_review_date: tomorrow`.

On re-review, interval multiplied by difficulty:
- **Easy** = 3x (well internalized, see it less)
- **Medium** = 2x (decent recall, standard spacing)
- **Hard** = 1x (struggling, keep interval the same)

Interval cap: 180 days. Missing SR fields are treated as defaults (backward-compatible).

### Concept notes (`30 Concept/`)

```yaml
---
origin: ai-generated | ai-assisted | human
review_status: unreviewed | in-review | reviewed | contested
reviewed_date:
last_updated: YYYY-MM-DD
source_count: 0          # number of sources contributing
tags: []
---
```

### Concept note structure

Concept pages are **lean hub nodes**. They do NOT list linked ideas — Obsidian's backlinks pane shows those automatically. Keep concepts minimal.

```markdown
# Concept Name

One-sentence definition.

## Tensions
2-3 sentences where sources disagree. Only if genuinely interesting.

## Related Concepts
[[concept1]] | [[concept2]] | [[concept3]]
```

That's the entire file. No "Key Insights" lists, no bullet points of ideas, no "Open Questions." The idea files link TO concepts via `[[wikilinks]]` in their Related Concepts section. Obsidian surfaces these as backlinks automatically.

## Operations

### Ingest

The human may provide input in several forms. **When the user sends a URL or text with no other instruction, assume they want it ingested.** Detect the type automatically and run the pipeline. Don't ask "what do you want me to do with this?" — just process it.

#### Input Detection

| Input | Type | Capture Method |
|-------|------|---------------|
| URL to article/blog | `article` | WebFetch → full markdown text |
| URL to YouTube video | `video` or `podcast` | `yt-dlp` → transcript (requires yt-dlp installed) |
| URL to podcast page | `podcast` | WebFetch → show notes; note if transcript unavailable |
| URL (ambiguous) | Infer type | WebFetch the page, detect from content |
| Pasted/typed text about something they read/heard | Infer type | Use text as-is — this is the human's synthesis |
| Pasted/typed personal reflection | `personal` | Use text as-is |
| File dropped in Inbox | Infer type | Read file, triage to correct folder |
| "process inbox" | Multiple | Process each Inbox item through the pipeline |

#### Pipeline (all input types)

**Step 1 — CAPTURE: Get the full content**

- **URL → article/blog**: Use WebFetch to get the full article as markdown. Preserve the complete text — do not summarize at this stage.
- **URL → YouTube**: Use `yt-dlp --write-auto-subs --skip-download --sub-lang en` to get transcript. If yt-dlp unavailable, use WebFetch on the page and note that transcript is incomplete.
- **URL → podcast (no YouTube)**: WebFetch the page for show notes and metadata. If no transcript available, note it and ask the human to describe key takeaways.
- **Text input**: Use exactly as provided. The human's own words are the source.
- **Inbox file**: Read the file contents.

**Step 2 — SOURCE: Create file in `10 Notes/<type>/`**

Create the source file with:
- Full content/transcript as the body (never summarize the source — keep it complete)
- Proper frontmatter (see Frontmatter Spec)
- `status: raw`
- For URLs: preserve the original URL in frontmatter
- For text input from the human: set `origin: human` in addition to standard fields

Filename format: `{Title} - {Author}.md` (or `{Title}.md` if no author)

**Step 3 — EXTRACT: Pull atomic ideas**

- Read the full source
- Identify 3-10 distinct atomic ideas (more for longer sources)
- For each idea, create a file in `20 Ideas/<type>/` with:
  - Descriptive filename (the idea itself, short)
  - Frontmatter with `review_status: unreviewed`, plus `source_date` (the source's publish/record date) and the primary person/org as tags — these anchor later **retro verification** of time-bound claims
  - **`## Insight` section**: 1-2 sentences max. Put the quote in context of the source (where in the argument it falls, what it builds on). No em-dashes. No generic summaries.
  - Wikilinks to related concepts
  - **`## Source Context` section** (mandatory) with the most specific source reference:
    - **Books**: Obsidian embed reference `![[Book - Author#^ref-XXXXX]]`
    - **Podcasts (YouTube)**: exact quote + `[MM:SS](youtube_url&t=seconds)` clickable timestamp link
    - **Podcasts (non-YouTube)**: exact quote + `[MM:SS]` display-only timestamp where available
    - **Articles**: exact blockquote from the source text
- Present the proposed ideas to the human before creating files (unless batch mode)

**Step 4 — SYNTHESIZE: Update `30 Concept/`**

- Ensure each idea's `## Related Concepts` section links to the correct concept pages
- If a concept page doesn't exist yet, create one (lean format: one-sentence definition + tensions + related concepts)
- Normalize concept names: merge duplicates (e.g., `decision-making` → `[[decision]]`)
- Do NOT add insight summaries to concept pages — Obsidian backlinks handle that automatically
- Concept pages are hub nodes. Keep them under 20 lines.

**Step 5 — LOG: Update operational files**

- Append entry to `00 Meta/log.md` with date, operation type, title, files created/updated
- Update `00 Meta/index.md` with new entries
- Update source file: `status: extracted` → `status: integrated`

**Step 6 — NOTIFY: Remind about review queue**

- Tell the human how many new items are in the review queue
- Suggest they check `00 Meta/review-queue.md` in Obsidian

**Step 7 — COMMIT: Persist to the repo**

- Commit every ingest to the repo as part of the workflow — don't leave it only in the working tree. Run `$REPO_PATH/sync.sh` (the path where you installed the sync script — see `ISA.md`), which stages the vault, commits on `main`, pushes a `sync/<timestamp>` branch, and opens a PR for the audit trail. The scheduled cron/launchd job runs the same script, so skipping this only delays the push; running it at end-of-ingest keeps the remote current and timestamps the learning.

### Auto-Fill Queue

Keeps the review pipeline fed. When unreviewed items drop below 10, suggest extracting 1-2 new sources.

**Trigger:** User says "fill my queue" or unreviewed count < 10 at session start.

**How it works:**
1. Check `00 Meta/review-queue.md` — count unreviewed items
2. If < 10 unreviewed, consult `00 Meta/extraction-tracker.md`
3. Suggest the top 1-2 un-extracted sources by richness (e.g. `highlightsCount` for books — richer sources first)
4. Run the standard Ingest pipeline (Step 1-6) on user approval
5. Update extraction-tracker.md: move the source to the "Extracted" table, record date and idea count

### Query

When the human asks a question about their knowledge:

1. Read `00 Meta/index.md` to find relevant pages
2. Read relevant wiki pages
3. Synthesize an answer with `[[wikilink]]` citations
4. If the answer is valuable, offer to file it as a new concept or idea page

### Lint

When asked to health-check the wiki:

1. Find contradictions between pages
2. Find orphan pages (no inbound links)
3. Find concepts mentioned but lacking their own page
4. Find stale claims superseded by newer sources
5. Suggest new questions to investigate or sources to find
6. Report findings, fix with human approval

### Review Support

When the human wants to review:

1. Point them to `00 Meta/review-queue.md` (Dataview dashboard) — or the private `/review` page in the web app
2. When they approve an item: update `review_status: reviewed` and set `reviewed_date`
3. When they contest an item: update `review_status: contested` and note their concern
4. When they edit an item: update `origin: ai-assisted` and `review_status: reviewed`

## Review Status Definitions

| Status | Meaning |
|--------|---------|
| `unreviewed` | AI produced it, human hasn't engaged yet |
| `in-review` | Human started reading, not finished processing |
| `reviewed` | Human has read, thought about it, internalized it |
| `contested` | Human reviewed but disagrees or wants to revisit |

## Attribution

| Origin | Meaning |
|--------|---------|
| `human` | Human wrote this entirely |
| `ai-generated` | LLM created this (extraction, synthesis) |
| `ai-assisted` | Human wrote with LLM help, or edited LLM output |
| `source` | External content (Kindle highlights, article clips) |

## What NOT To Do

- Do not modify anything in `10 Notes/` (raw sources are sacred)
- Do not create files without proper frontmatter
- Do not mark anything as `reviewed` — only the human does that
- Do not skip updating index.md and log.md after operations
- Do not create files outside the established folder structure
- Do not add emojis to files unless the human asks for them
- Do not reorganize existing files unless explicitly asked
