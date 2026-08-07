import { listFiles, getFilesContent } from "./github";
import { parseFrontmatter, extractTitle } from "./parser";
import { extractSection, firstParagraph } from "./markdown";

// A source that feeds a concept, derived from the idea notes that cite it.
// `type` is the note's own source_type so each chip gets its real icon.
// YouTube-hosted sources (podcasts and videos) carry an episode URL.
export interface TensionSource {
  name: string;
  type: string;
  url?: string;
}

// A productive disagreement: a concept whose sources pull in different directions.
export interface Tension {
  concept: string;
  slug: string;
  url: string;
  definition: string;
  text: string;
  tags: string[];
  sources: TensionSource[];
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
// First YouTube link in an idea's body; the episode URL minus any &t= timestamp.
const YT_RE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s)]*|youtu\.be\/[^\s)?]+)/;

function cleanSourceName(raw: string): string {
  return raw.replace(/\[\[|\]\]/g, "").split("/").pop()?.trim() || "";
}

// Map each concept (by lowercased filename) to the deduped set of sources from
// the idea notes that wikilink to it.
async function buildConceptSources(): Promise<Map<string, TensionSource[]>> {
  const ideaPaths = await listFiles("20 Ideas");
  const files = await getFilesContent(ideaPaths);

  const byConcept = new Map<string, Map<string, TensionSource>>();

  for (const path of ideaPaths) {
    const file = files.get(path);
    if (!file) continue;

    const { frontmatter, content } = parseFrontmatter(file.content);
    const sourceName =
      typeof frontmatter.source === "string"
        ? cleanSourceName(frontmatter.source)
        : "";
    if (!sourceName) continue;

    const type =
      typeof frontmatter.source_type === "string"
        ? frontmatter.source_type
        : "book";
    const urlMatch =
      type === "podcast" || type === "video" ? content.match(YT_RE) : null;
    // Drop the timestamp (e.g. &t=605s, &t=1h2m3s) so the chip opens the episode.
    const url = urlMatch
      ? urlMatch[0].replace(/[?&]t=[\dhms]+/, "")
      : undefined;

    const cited = new Set<string>();
    WIKILINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKILINK_RE.exec(content)) !== null) {
      cited.add((m[1].split("/").pop() || m[1]).trim().toLowerCase());
    }

    for (const concept of cited) {
      if (!byConcept.has(concept)) byConcept.set(concept, new Map());
      const sources = byConcept.get(concept)!;
      const existing = sources.get(sourceName);
      if (!existing) {
        sources.set(sourceName, { name: sourceName, type, url });
      } else if (!existing.url && url) {
        sources.set(sourceName, { ...existing, url });
      }
    }
  }

  const out = new Map<string, TensionSource[]>();
  for (const [concept, sources] of byConcept) {
    out.set(concept, [...sources.values()]);
  }
  return out;
}

// Every concept with a substantive "## Tensions" section, with its sources.
export async function getTensions(): Promise<Tension[]> {
  const [paths, conceptSources] = await Promise.all([
    listFiles("30 Concept"),
    buildConceptSources(),
  ]);
  const files = await getFilesContent(paths);

  const out: Tension[] = [];
  for (const path of paths) {
    const file = files.get(path);
    if (!file) continue;

    const { frontmatter, content } = parseFrontmatter(file.content);
    const text = extractSection(content, "Tensions");
    if (text.length < 40) continue; // skip empty / placeholder

    const filename = path.split("/").pop()?.replace(/\.md$/, "") || "";
    const slug = slugify(filename);
    out.push({
      concept: extractTitle(content, path),
      slug,
      url: `/concepts/${slug}`,
      definition: firstParagraph(content),
      text,
      tags: Array.isArray(frontmatter.tags)
        ? (frontmatter.tags as string[])
        : [],
      sources: conceptSources.get(filename.toLowerCase()) || [],
    });
  }
  return out;
}
