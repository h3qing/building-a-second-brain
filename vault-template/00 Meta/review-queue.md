---
origin: ai-generated
review_status: reviewed
---

# Review Queue

Your systematic review dashboard. Install the **Dataview** plugin to see live queries.

---

## Unreviewed Items (newest first)

These need your attention. Read each one, then update `review_status` in the frontmatter.

```dataview
TABLE origin, source, file.ctime as "Created"
FROM "20 Ideas" OR "30 Concept"
WHERE review_status = "unreviewed"
SORT file.ctime DESC
```

## In Review

Items you've started but haven't finished processing.

```dataview
TABLE origin, source
FROM "20 Ideas" OR "30 Concept"
WHERE review_status = "in-review"
SORT file.mtime DESC
```

## Contested

Items you disagree with or want to revisit. Bring these to a Claude Code session for revision.

```dataview
TABLE origin, source, reviewed_date
FROM "20 Ideas" OR "30 Concept"
WHERE review_status = "contested"
SORT reviewed_date DESC
```

## Recently Reviewed

Your thick memory. Items you've internalized.

```dataview
TABLE reviewed_date, origin, source_count
FROM "20 Ideas" OR "30 Concept"
WHERE review_status = "reviewed"
SORT reviewed_date DESC
LIMIT 30
```

## Stats

### Total by status
```dataview
TABLE length(rows) as "Count"
FROM "20 Ideas" OR "30 Concept"
WHERE review_status
GROUP BY review_status
```

### Sources not yet extracted
```dataview
TABLE source_type, date_ingested
FROM "10 Notes"
WHERE status = "raw"
SORT date_ingested DESC
```
