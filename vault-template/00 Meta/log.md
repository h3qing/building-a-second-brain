---
origin: ai-generated
review_status: reviewed
---

# Log

Append-only operational log. The LLM adds an entry after every ingest or significant operation. The web app's homepage feed reads dated lines (`- YYYY-MM-DD ...`) from this file.

Format:

```markdown
## [YYYY-MM-DD] operation | Title
- Description of what was done
- Files created/updated: list
```

Operations: `ingest`, `query`, `lint`, `review`, `restructure`

---

<!-- Newest entries go here, e.g.:

## [2026-01-15] ingest | Atomic Habits - James Clear
- Extracted 7 atomic ideas, created 3 new concepts
- Files: 20 Ideas/Books/*.md, 30 Concept/{habits,identity,systems}.md
-->
