# Podcast Index — catalog API for podcast ingest

A **method note** for the second-brain ingest pipeline: how to use [Podcast Index](https://podcastindex.org/) as a public catalog and metadata API when capturing podcast episodes into `10 Notes/Podcasts/`.

Podcast Index is **not a player**. It does not know what is in your personal queue or subscription list. It indexes what exists in the open podcast ecosystem — show metadata, RSS URLs, episode lists, and (when publishers provide them) chapter and transcript links.

## Purpose

Use Podcast Index when you need to:

- **Search** for a show by title or keyword
- **Resolve** a feed URL, feed id, or Apple/iTunes id to canonical metadata
- **List episodes** for a feed in reverse chronological order
- **Fetch episode details** that may include `chaptersUrl` and `transcriptUrl` (Podcasting 2.0)
- **Discover recently updated feeds** across the index (`recent/feeds`)

It does **not** stream audio, sync your listening history, or expose a user's subscribed shows from Apple Podcasts, Overcast, Xiaoyuzhou (小宇宙), or similar apps — those services have no official user-library API.

## Official links

| Resource | URL |
|----------|-----|
| Apply for an API key | https://api.podcastindex.org/ |
| Developer docs (auth + endpoints) | https://api.podcastindex.org/developer_docs |
| OpenAPI / reference | https://podcastindex-org.github.io/docs-api/ |
| API base URL | `https://api.podcastindex.org` |

Store `PODCAST_INDEX_KEY` and `PODCAST_INDEX_SECRET` in your environment or vault secrets — never commit them to a public repo.

## Authentication (every request)

Every call requires four headers. The timestamp must be within a **5-minute window** of server time.

| Header | Value |
|--------|-------|
| `User-Agent` | Your product name and version (e.g. `MySecondBrain/1.0`) |
| `X-Auth-Key` | Your API key |
| `X-Auth-Date` | Current Unix epoch time as a **string** |
| `Authorization` | `sha1(apiKey + apiSecret + unixTime)` — lowercase hex digest |

Example (bash):

```bash
API_KEY="$PODCAST_INDEX_KEY"
API_SECRET="$PODCAST_INDEX_SECRET"
UNIX_TIME=$(date +%s)
AUTH=$(printf '%s' "${API_KEY}${API_SECRET}${UNIX_TIME}" | sha1sum | awk '{print $1}')

curl -sG "https://api.podcastindex.org/api/1.0/search/byterm" \
  --data-urlencode "q=history of philosophy" \
  -H "User-Agent: MySecondBrain/1.0" \
  -H "X-Auth-Key: ${API_KEY}" \
  -H "X-Auth-Date: ${UNIX_TIME}" \
  -H "Authorization: ${AUTH}"
```

## Common endpoints

All paths are under `/api/1.0/`. URL-encode query parameters.

### Search

- `GET /search/byterm?q=` — feeds whose titles match the search term

### Podcasts (feeds)

- `GET /podcasts/byfeedurl?url=` — everything known about a feed URL
- `GET /podcasts/byfeedid?id=` — same, by internal Podcast Index feed id
- `GET /podcasts/byitunesid?id=` — same, by Apple/iTunes id (with or without `id` prefix)
- `POST /add/byfeedurl?url=` — submit a missing feed (**requires a read-write API key**); returns existing feed id if already indexed

### Episodes

- `GET /episodes/byfeedurl?url=` — all episodes for a feed, newest first
- `GET /episodes/byfeedid?id=` — same, by feed id
- `GET /episodes/byid?id=` — single episode; response may include `chaptersUrl` and `transcriptUrl` when the publisher provides them

### Recent (firehose)

- `GET /recent/feeds?since=&max=` — feeds updated since `since` (Unix epoch); default `since` is ~15 minutes ago, default `max` is 40

See the [developer docs](https://api.podcastindex.org/developer_docs) and [OpenAPI reference](https://podcastindex-org.github.io/docs-api/) for optional parameters (`max`, `fulltext`, etc.) and response fields.

## Chapters and transcripts

When ingesting a podcast episode, transcripts are the gate for idea extraction in this pipeline — **no transcript → no Ideas**.

Resolution order:

1. **Podcast Index episode object** — check `transcriptUrl` and `chaptersUrl` on the `/episodes/byid` response (Podcasting 2.0 tags surfaced by the index).
2. **Episode RSS item** — fetch the feed and look for `<podcast:transcript>` and `<podcast:chapters>` on the matching item. Common `type` values include `text/vtt`, `application/json`, and `text/html`.
3. **Neither available** — record in the source note that no transcript exists. Do **not** invent or hallucinate transcript text. Ask the human for key takeaways, or skip extraction until a transcript appears.

Many older shows publish audio only. That is normal.

## Division of labor

| System | Role |
|--------|------|
| **Podcast Index** | Global catalog — what shows and episodes exist, RSS URLs, optional transcript/chapter links |
| **RSS feed** | Publisher source of truth for episode enclosure, show notes, and Podcasting 2.0 tags |
| **Podcast player** (e.g. [Podverse](https://podverse.fm/) with a user-queue API) | What *you* queued or subscribed to — personal listening state |
| **Apple Podcasts / Overcast / Xiaoyuzhou** | No official API for a user's library or queue |

If you know a show's RSS URL, Podcast Index and the RSS feed both work without any player integration.

## How this fits the ingest pipeline

Recommended flow when capturing a podcast episode:

1. **Identify the episode** — search by show title (`/search/byterm`), or resolve from a feed URL / iTunes id.
2. **Load episode metadata** — `/episodes/byid` or list via `/episodes/byfeedid` and match title/date.
3. **Resolve transcript** — follow `transcriptUrl` or RSS `<podcast:transcript>`; fetch the actual text (VTT, JSON, or HTML as published).
4. **Create the source note** — full transcript (or explicit "no transcript" callout) in `10 Notes/Podcasts/`, with `source_type: podcast`, `url`, and capture method documented.
5. **Extract Ideas** — only when step 3 succeeded with real transcript content.

This keeps `10 Notes/` immutable and faithful: the source note reflects what was actually available, not a summary guessed from show notes alone.

## Related pipeline docs

- [`vault-template/CLAUDE.md`](../vault-template/CLAUDE.md) — ingest rules and capture methods
- [`.claude/skills/capture-knowledge/`](../vault-template/.claude/skills/capture-knowledge/SKILL.md) — operational capture skill
