import { listFiles, getFilesContent } from "./github";
import { parseFrontmatter, extractTitle } from "./parser";

// A single recall-able knowledge item (idea or concept) with its
// spaced-repetition state, shaped for the Recall API.
export interface RecallItem {
  type: "idea" | "concept";
  title: string;
  slug: string;
  url: string; // relative, e.g. /concepts/negotiation
  source: string | null;
  excerpt: string;
  tags: string[];
  status: string;
  reviewCount: number | null;
  nextReviewDate: string | null;
  difficulty: string | null;
}

// Mirrors the slug rule in lib/content.ts so URLs match the rendered pages.
function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// First prose paragraph (a concept's definition, or an idea's insight),
// skipping headings and bare wikilink lines.
function firstParagraph(content: string): string {
  const buf: string[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || /^\[\[.*\]\]$/.test(line)) {
      if (buf.length) break;
      continue;
    }
    buf.push(line);
    if (buf.join(" ").length > 240) break;
  }
  const text = buf.join(" ").replace(/\s+/g, " ").trim();
  return text.length > 280 ? text.slice(0, 277).trimEnd() + "…" : text;
}

// Read every reviewable idea + concept and project it to a RecallItem.
export async function getRecallItems(): Promise<RecallItem[]> {
  const [ideaPaths, conceptPaths] = await Promise.all([
    listFiles("20 Ideas"),
    listFiles("30 Concept"),
  ]);
  const allPaths = [...ideaPaths, ...conceptPaths];
  const files = await getFilesContent(allPaths);

  const items: RecallItem[] = [];
  for (const path of allPaths) {
    const file = files.get(path);
    if (!file) continue;

    const { frontmatter, content } = parseFrontmatter(file.content);
    if (!frontmatter.review_status) continue;

    const isIdea = path.startsWith("20 Ideas");
    const filename = path.split("/").pop()?.replace(/\.md$/, "") || "";
    const slug = slugify(filename);
    const source =
      typeof frontmatter.source === "string"
        ? frontmatter.source.replace(/\[\[|\]\]/g, "").split("/").pop() || null
        : null;

    items.push({
      type: isIdea ? "idea" : "concept",
      title: extractTitle(content, path),
      slug,
      url: isIdea ? `/ideas/${slug}` : `/concepts/${slug}`,
      source,
      excerpt: firstParagraph(content),
      tags: Array.isArray(frontmatter.tags) ? (frontmatter.tags as string[]) : [],
      status: frontmatter.review_status as string,
      reviewCount:
        typeof frontmatter.review_count === "number"
          ? frontmatter.review_count
          : null,
      nextReviewDate:
        typeof frontmatter.next_review_date === "string"
          ? frontmatter.next_review_date
          : null,
      difficulty:
        typeof frontmatter.difficulty === "string"
          ? frontmatter.difficulty
          : null,
    });
  }
  return items;
}

// Reviewed items whose spaced-repetition date has come due (<= today, YYYY-MM-DD).
export function dueItems(items: RecallItem[], today: string): RecallItem[] {
  return items.filter(
    (i) => i.status === "reviewed" && i.nextReviewDate && i.nextReviewDate <= today
  );
}

// Random sample without mutating the input array.
export function sample<T>(arr: T[], n: number): T[] {
  return [...arr]
    .map((value) => ({ value, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, Math.max(0, n))
    .map((x) => x.value);
}

// Token check for the Recall API. Returns "unconfigured" when RECAP_TOKEN is
// unset (the endpoint should 503 — never serve private review data by default).
export function recapAuth(
  authHeader: string | null,
  queryToken: string | null
): "ok" | "unconfigured" | "denied" {
  const token = process.env.RECAP_TOKEN;
  if (!token) return "unconfigured";
  const bearer = authHeader?.replace(/^Bearer\s+/i, "") ?? null;
  return bearer === token || queryToken === token ? "ok" : "denied";
}

// Render a list of labelled sections as a plain-text or markdown digest.
export function renderDigest(
  heading: string,
  sections: Array<{ label: string; items: RecallItem[] }>,
  origin: string,
  format: "text" | "md"
): string {
  const md = format === "md";
  const lines: string[] = [md ? `# ${heading}` : heading.toUpperCase(), ""];

  for (const { label, items } of sections) {
    if (!items.length) continue;
    lines.push(md ? `## ${label}` : `${label}:`, "");
    for (const it of items) {
      const link = `${origin}${it.url}`;
      const titleLine = md ? `- **${it.title}** (${it.type})` : `• ${it.title} (${it.type})`;
      lines.push(titleLine);
      if (it.excerpt) lines.push(`  ${it.excerpt}`);
      lines.push(md ? `  ${link}` : `  ${link}`, "");
    }
  }
  if (lines.at(-1) === "") lines.pop();
  return lines.join("\n") + "\n";
}
