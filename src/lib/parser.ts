import matter from "gray-matter";
import { getFileViaTree } from "./github";
import { addDaysISO, daysBetween, toISODate } from "./time";
import { extractSection } from "./markdown";

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
  // The `## Recall` prompt: a question whose answer is the insight. Empty for
  // notes extracted before the section existed.
  recallQuestion: string;
  frontmatter: Record<string, unknown>;
  rawContent: string;
}

export interface SourceHighlight {
  ref: string;
  text: string;
  location: string;
}

// Write a note back to markdown. js-yaml reads an unquoted `2026-05-20` as a
// Date, and dumping that Date again stores `2026-05-20T00:00:00.000Z` — so
// every in-app review used to rewrite each date field in the note. Keep plain
// calendar dates plain.
export function stringifyNote(
  content: string,
  data: Record<string, unknown>
): string {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const iso =
      value instanceof Date && !isNaN(value.getTime())
        ? value.toISOString()
        : "";
    clean[key] = iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : value;
  }
  return matter.stringify(content, clean);
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

export function extractRelatedConcepts(content: string): string[] {
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

  // Book embeds (`![[Book#^ref-123]]`) are resolved into the Original
  // Highlight block — never echo them here as raw wikilink syntax.
  const text = section[1].replace(/!\[\[[^\]]*\]\]/g, "").trim();
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
    // [ \t]* not \s*: \s would run across the blank ">" line between quoted
    // paragraphs and swallow the next line's ">" into the quote text.
    const blockquotes = text.match(/^>[ \t]*.+$/gm);
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
      const file = await getFileViaTree(sourcePath);
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
  const recallQuestion = extractSection(content, "Recall")
    .replace(/^(?:[-*>]\s*)?(?:Q[:：]|问[:：])?\s*/i, "")
    .trim();

  return {
    path,
    sha,
    title,
    content,
    sourceHighlights,
    sourceContext,
    relatedConcepts,
    recallQuestion,
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
    return stringifyNote(replaced, updated);
  }

  // No existing ## Insight section — insert after the H1
  const h1End = content.match(/^#\s+.+$/m);
  if (h1End) {
    const idx = content.indexOf(h1End[0]) + h1End[0].length;
    const before = content.slice(0, idx);
    const after = content.slice(idx);
    const inserted = `${before}\n\n## Insight\n${newInsight.trim()}\n${after}`;
    return stringifyNote(inserted, updated);
  }

  return stringifyNote(content, updated);
}

// "forgot" is the lapse button: the card couldn't be recalled at all.
export type Difficulty = "easy" | "medium" | "hard" | "forgot";

const DIFFICULTY_MULTIPLIER: Record<Exclude<Difficulty, "forgot">, number> = {
  easy: 3,
  medium: 2,
  hard: 1,
};

// How much of an overdue gap counts as proof the memory lasted. Recalling a
// card easily 30 days past due shows it held for those 30 days; a hard recall
// shows nothing extra. (The same delay credit Anki's scheduler gives.)
const OVERDUE_CREDIT: Record<Exclude<Difficulty, "forgot">, number> = {
  easy: 1,
  medium: 0.5,
  hard: 0,
};

const MAX_INTERVAL = 180;

// Next interval in days, from the scheduled interval and the days actually
// elapsed since the last review:
// - forgot: the memory is gone, so it relearns from a 1-day interval.
// - early (elapsed < interval, e.g. opened from the Reviewed list): only the
//   elapsed days are proven, so growth is scaled from those — and never
//   shrinks the interval.
// - on time: interval × multiplier (Easy 3×, Medium 2×, Hard 1×).
// - overdue: the late days count toward the base per OVERDUE_CREDIT.
export function computeNextInterval(
  currentInterval: number,
  difficulty: Difficulty,
  elapsedDays?: number
): number {
  if (difficulty === "forgot") return 1;
  const elapsed =
    elapsedDays === undefined ? currentInterval : Math.max(0, elapsedDays);
  const earned =
    elapsed < currentInterval
      ? elapsed
      : currentInterval +
        (elapsed - currentInterval) * OVERDUE_CREDIT[difficulty];
  const next = Math.round(
    Math.max(currentInterval, earned * DIFFICULTY_MULTIPLIER[difficulty])
  );
  return Math.min(next, MAX_INTERVAL);
}

// Days since the last review, or undefined when there's no usable date.
export function elapsedSince(
  lastReviewed: unknown,
  today: string
): number | undefined {
  const last = toISODate(lastReviewed);
  return last ? daysBetween(last, today) : undefined;
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
    updated.next_review_date = addDaysISO(date, 1);
  }

  return stringifyNote(content, updated);
}

// How a checked prediction turned out. Stored as `prediction_outcome`.
export const PREDICTION_OUTCOMES = ["came-true", "partly", "wrong"] as const;
export type PredictionOutcome = (typeof PREDICTION_OUTCOMES)[number];

// Record a prediction check. Leaves review status and the SR schedule alone:
// checking a claim against the world is a different act from recalling it.
export function updatePredictionOutcome(
  rawContent: string,
  outcome: PredictionOutcome,
  date: string
): string {
  const { data, content } = matter(rawContent);
  return stringifyNote(content, {
    ...data,
    prediction_outcome: outcome,
    verified_date: date,
  });
}

// Toggle a note's star flag without touching its review status or SR schedule.
// Starring just marks a note worth coming back to; it lives alongside the
// review metadata in the same frontmatter.
export function updateStarStatus(rawContent: string, starred: boolean): string {
  const { data, content } = matter(rawContent);
  const updated = { ...data, starred };
  return stringifyNote(content, updated);
}

export function updateSpacedRepetition(
  rawContent: string,
  difficulty: Difficulty,
  date: string
): string {
  const { data, content } = matter(rawContent);
  const currentInterval = (data.review_interval as number) || 1;
  const currentCount = (data.review_count as number) || 1;
  const nextInterval = computeNextInterval(
    currentInterval,
    difficulty,
    elapsedSince(data.reviewed_date, date)
  );

  const updated: Record<string, unknown> = {
    ...data,
    review_status: "reviewed",
    reviewed_date: date,
    review_count: currentCount + 1,
    review_interval: nextInterval,
    next_review_date: addDaysISO(date, nextInterval),
    difficulty,
  };
  // Count lapses: a card forgotten again and again is usually a badly shaped
  // card (too big, too vague), worth rewriting rather than drilling.
  if (difficulty === "forgot") {
    updated.lapses = ((data.lapses as number) || 0) + 1;
  }

  return stringifyNote(content, updated);
}
