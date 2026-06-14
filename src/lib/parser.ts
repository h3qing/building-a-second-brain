import matter from "gray-matter";
import { getFileContent } from "./github";

export interface SourceContext {
  quote: string;
  timestampLabel?: string;
  timestampUrl?: string;
}

export interface ReviewItem {
  path: string;
  sha: string;
  title: string;
  content: string;
  sourceHighlights: SourceHighlight[];
  sourceContext: SourceContext[];
  relatedConcepts: string[];
  frontmatter: Record<string, unknown>;
  rawContent: string;
}

export interface SourceHighlight {
  ref: string;
  text: string;
  location: string;
}

export function parseFrontmatter(raw: string) {
  try {
    const { data, content } = matter(raw);
    return { frontmatter: data, content: content.trim() };
  } catch {
    // Malformed YAML frontmatter — return content as-is
    return { frontmatter: {} as Record<string, unknown>, content: raw.trim() };
  }
}

export function extractTitle(content: string, path: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  const filename = path.split("/").pop() || "";
  return filename.replace(/\.md$/, "");
}

function extractEmbedRefs(content: string): string[] {
  const regex = /!\[\[([^\]]+?)#\^(ref-\d+)\]\]/g;
  const refs: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    refs.push(`${match[1]}#^${match[2]}`);
  }
  return refs;
}

function extractRelatedConcepts(content: string): string[] {
  const conceptSection = content.match(
    /##\s*Related\s*Concepts?\s*\n([\s\S]*?)(?=\n##|\n$|$)/i
  );
  if (!conceptSection) return [];
  const links = conceptSection[1].match(/\[\[([^\]]+)\]\]/g) || [];
  return links.map((l) => l.replace(/\[\[|\]\]/g, ""));
}

export function extractSourceContext(content: string): SourceContext[] {
  const section = content.match(
    /##\s*Source\s*Context\s*\n([\s\S]*?)(?=\n##|\n$|$)/i
  );
  if (!section) return [];

  const text = section[1].trim();
  if (!text) return [];

  const contexts: SourceContext[] = [];

  // Match lines with YouTube timestamp links: [MM:SS](url&t=seconds)
  const timestampRegex = /\[(\d+:\d+)\]\((https?:\/\/[^\s)]*(?:youtube|youtu\.be)[^\s)]*)\)/g;
  let match;
  while ((match = timestampRegex.exec(text)) !== null) {
    // Get surrounding quote text (the blockquote or paragraph containing this link)
    const beforeLink = text.slice(0, match.index);
    const afterLink = text.slice(match.index + match[0].length);

    // Find the quote: look for the line/paragraph containing this timestamp
    const lines = beforeLink.split("\n");
    const quoteLine = lines[lines.length - 1]
      .replace(/^>\s*/, "")
      .replace(/^[-*]\s*/, "")
      .trim();

    const afterLines = afterLink.split("\n")[0].trim();
    const fullQuote = (quoteLine + " " + afterLines)
      .replace(/\s+/g, " ")
      .trim();

    contexts.push({
      // Never fall back to the raw markdown link — a bare timestamp with no
      // surrounding prose renders as just the timestamp link, not "[29:55](url)".
      quote: fullQuote,
      timestampLabel: match[1],
      timestampUrl: match[2],
    });
  }

  // If no timestamps found, extract blockquotes as plain source context
  if (contexts.length === 0) {
    const blockquotes = text.match(/^>\s*.+$/gm);
    if (blockquotes) {
      for (const bq of blockquotes) {
        const clean = bq.replace(/^>\s*/, "").trim();
        if (clean) contexts.push({ quote: clean });
      }
    } else if (text.length > 0) {
      // Fallback: treat the entire section as context
      contexts.push({ quote: text });
    }
  }

  return contexts;
}

export async function resolveHighlights(
  content: string
): Promise<SourceHighlight[]> {
  const embedRefs = extractEmbedRefs(content);
  if (embedRefs.length === 0) return [];

  const highlights: SourceHighlight[] = [];
  const sourceCache = new Map<string, string>();

  for (const ref of embedRefs) {
    const [sourceName, blockRef] = ref.split("#^");
    const sourcePath = `10 Notes/Kindle Notes/${sourceName}.md`;

    let sourceContent = sourceCache.get(sourcePath);
    if (sourceContent === undefined) {
      const file = await getFileContent(sourcePath);
      sourceContent = file?.content || "";
      sourceCache.set(sourcePath, sourceContent);
    }

    if (sourceContent) {
      const refId = `^${blockRef}`;
      const lines = sourceContent.split("\n");
      for (const line of lines) {
        if (line.includes(refId)) {
          const cleanLine = line.replace(/\s*\^ref-\d+\s*$/, "").trim();
          const locMatch = cleanLine.match(
            /—\s*location:\s*\[(\d+)\]\(.*?\)/
          );
          const text = cleanLine
            .replace(/—\s*location:\s*\[.*?\]\(.*?\)/, "")
            .trim();
          highlights.push({
            ref: blockRef,
            text,
            location: locMatch ? `loc: ${locMatch[1]}` : "",
          });
          break;
        }
      }
    }
  }

  return highlights;
}

export async function parseReviewItem(
  path: string,
  sha: string,
  rawContent: string
): Promise<ReviewItem> {
  const { frontmatter, content } = parseFrontmatter(rawContent);
  const title = extractTitle(content, path);
  const sourceHighlights = await resolveHighlights(content);
  const sourceContext = extractSourceContext(content);
  const relatedConcepts = extractRelatedConcepts(content);

  return {
    path,
    sha,
    title,
    content,
    sourceHighlights,
    sourceContext,
    relatedConcepts,
    frontmatter,
    rawContent,
  };
}

export function replaceInsight(rawContent: string, newInsight: string): string {
  const { data, content } = matter(rawContent);
  const updated = { ...data, origin: "ai-assisted" };

  // Replace the ## Insight section content, preserving everything else
  const insightRegex = /(##\s*Insight\s*\n)([\s\S]*?)(?=\n##|$)/i;
  const match = content.match(insightRegex);
  if (match) {
    const replaced = content.replace(insightRegex, `$1${newInsight.trim()}\n`);
    return matter.stringify(replaced, updated);
  }

  // No existing ## Insight section — insert after the H1
  const h1End = content.match(/^#\s+.+$/m);
  if (h1End) {
    const idx = content.indexOf(h1End[0]) + h1End[0].length;
    const before = content.slice(0, idx);
    const after = content.slice(idx);
    const inserted = `${before}\n\n## Insight\n${newInsight.trim()}\n${after}`;
    return matter.stringify(inserted, updated);
  }

  return matter.stringify(content, updated);
}

export type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 3,
  medium: 2,
  hard: 1,
};

const MAX_INTERVAL = 180;

export function computeNextInterval(
  currentInterval: number,
  difficulty: Difficulty
): number {
  const next = currentInterval * DIFFICULTY_MULTIPLIER[difficulty];
  return Math.min(next, MAX_INTERVAL);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

export function updateReviewStatus(
  rawContent: string,
  status: "reviewed" | "contested",
  date: string
): string {
  const { data, content } = matter(rawContent);
  const updated: Record<string, unknown> = {
    ...data,
    review_status: status,
    reviewed_date: date,
  };

  // First approval: initialize SR fields
  if (status === "reviewed" && !data.review_count) {
    updated.review_count = 1;
    updated.review_interval = 1;
    updated.next_review_date = addDays(date, 1);
  }

  return matter.stringify(content, updated);
}

// Toggle a note's star flag without touching its review status or SR schedule.
// Starring just marks a note worth coming back to; it lives alongside the
// review metadata in the same frontmatter.
export function updateStarStatus(rawContent: string, starred: boolean): string {
  const { data, content } = matter(rawContent);
  const updated = { ...data, starred };
  return matter.stringify(content, updated);
}

export function updateSpacedRepetition(
  rawContent: string,
  difficulty: Difficulty,
  date: string
): string {
  const { data, content } = matter(rawContent);
  const currentInterval = (data.review_interval as number) || 1;
  const currentCount = (data.review_count as number) || 1;
  const nextInterval = computeNextInterval(currentInterval, difficulty);

  const updated = {
    ...data,
    review_status: "reviewed",
    reviewed_date: date,
    review_count: currentCount + 1,
    review_interval: nextInterval,
    next_review_date: addDays(date, nextInterval),
    difficulty,
  };

  return matter.stringify(content, updated);
}
