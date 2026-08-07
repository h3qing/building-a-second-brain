---
origin: ai-assisted
review_status: reviewed
last_updated: 2026-01-01
---

# Wiki Schema & Conventions

This document defines the conventions for this LLM Wiki vault. It is co-evolved by the human and LLM over time. See also: [[CLAUDE]] (the session-level pipeline loaded by Claude Code).

## Frontmatter Fields

### Required on ALL files created by the LLM

| Field | Values | Purpose |
|-------|--------|---------|
| `origin` | `human`, `ai-generated`, `ai-assisted`, `source` | Who created this |
| `review_status` | `unreviewed`, `in-review`, `reviewed`, `contested` | Has the human engaged with this |

### Source notes (`10 Notes/`)

| Field | Required | Description |
|-------|----------|-------------|
| `source_type` | Yes | `article`, `book`, `podcast`, `conversation`, `course`, `video`, `personal` |
| `title` | Yes | Title of the source |
| `author` | If known | Author or speaker |
| `date_ingested` | Yes | YYYY-MM-DD when added to vault |
| `url` | If applicable | Original URL |
| `status` | Yes | `raw` (just filed), `extracted` (ideas pulled), `integrated` (concepts updated) |
| `tags` | Yes | Topic tags |

Note: Kindle Notes have their own plugin-generated frontmatter. Do not modify it.

### Idea notes (`20 Ideas/`)

| Field | Required | Description |
|-------|----------|-------------|
| `source` | Yes | Wikilink to source file in `10 Notes/` |
| `source_type` | Yes | Mirrors the source's type |
| `origin` | Yes | Usually `ai-generated` |
| `review_status` | Yes | Starts as `unreviewed` |
| `reviewed_date` | When reviewed | YYYY-MM-DD |
| `review_count`, `review_interval`, `next_review_date`, `difficulty` | Spaced repetition | See [[CLAUDE]] → Spaced Repetition |
| `tags` | Yes | First 1-2 are Topic labels; rest are descriptors |

### Concept notes (`30 Concept/`)

| Field | Required | Description |
|-------|----------|-------------|
| `origin` | Yes | Usually `ai-generated` or `ai-assisted` |
| `review_status` | Yes | Starts as `unreviewed` |
| `reviewed_date` | When reviewed | YYYY-MM-DD |
| `last_updated` | Yes | YYYY-MM-DD of last edit |
| `source_count` | Yes | Number of sources contributing |
| `tags` | Yes | Topic tags |

### Person notes (`50 People/`)

| Field | Required | Description |
|-------|----------|-------------|
| `origin` | Yes | Usually `ai-generated` or `ai-assisted` |
| `review_status` | Yes | Starts as `unreviewed` |
| `roles` | Yes | How they enter the vault: `author` / `host` / `guest` / `subject` |
| `affiliation` | No | Current org/role, short |
| `aliases` | No | Romanization, alternate names (so links resolve either way) |
| `last_updated` | Yes | YYYY-MM-DD of last edit |
| `tags` | Yes | Their kebab-case name tag (e.g. `morgan-housel`) + orgs |

## Naming Conventions

- **Source files**: `{Title} - {Author}.md` (e.g., `Atomic Habits - Clear.md`)
- **Idea files**: Short descriptive title of the idea (e.g., `habits are compound interest.md`)
- **Concept files**: Lowercase concept name (e.g., `negotiation.md`, `decision-making.md`)
- **Person files**: The person's common name (e.g., `Morgan Housel.md`, `张小珺.md`)
- Use hyphens for multi-word concept filenames, title case for display

## Wikilink Conventions

- Link to concepts: `[[negotiation]]`, `[[decision-making]]`
- Link to sources: `[[10 Notes/Kindle Notes/Atomic Habits - Clear]]`
- Link to ideas: `[[habits are compound interest]]`
- When referencing a concept that doesn't have its own page yet, still use `[[wikilink]]` — Obsidian shows it as an unresolved link, which signals a concept page should be created

## Review Workflow

1. LLM creates content with `review_status: unreviewed`
2. Human opens `00 Meta/review-queue.md` (or the private `/review` page in the web app) to see what needs review
3. Human reads each item
4. Human updates frontmatter:
   - Approve: `review_status: reviewed`, add `reviewed_date: YYYY-MM-DD`
   - Contest: `review_status: contested`, add a `## Contested` section with notes
   - Edit: Change content, set `origin: ai-assisted`, `review_status: reviewed`
5. Items marked `contested` go back to the LLM for revision

## Log Format

Each entry in `00 Meta/log.md` follows this format:

```markdown
## [YYYY-MM-DD] operation | Title
- Description of what was done
- Files created/updated: list
```

Operations: `ingest`, `query`, `lint`, `review`, `restructure`
