import { getFileViaTree, listCommits } from "@/lib/github";
import { parseFrontmatter } from "@/lib/parser";
import { parseReviewEvents } from "@/lib/review-stats";
import {
  toISODate,
  todayISO,
  daysBetween,
  spanLabel,
  timeAgo,
  timeUntil,
  monthYear,
} from "@/lib/time";

interface JourneyRow {
  icon: string;
  text: string;
}

const SOURCE_LABEL: Record<string, [string, string]> = {
  book: ["📖", "Book published"],
  podcast: ["🎙", "Episode aired"],
  video: ["🎬", "Video released"],
  article: ["📰", "Article published"],
};

// The idea's life story: source → captured → first review → last review → next
// due. Dates come from frontmatter; the first-review date is recovered from
// the `review: …` commit trail (same data the stats heatmap uses); "captured"
// comes from the source note's date_ingested. Async — render inside Suspense.
export async function IdeaJourney({
  path,
  frontmatter,
}: {
  path: string;
  frontmatter: Record<string, unknown>;
}) {
  const today = todayISO();
  const slug = path.split("/").pop()?.replace(/\.md$/, "") || "";

  const sourceDate = toISODate(frontmatter.source_date);
  const reviewedDate = toISODate(frontmatter.reviewed_date);
  const nextReviewDate = toISODate(frontmatter.next_review_date);
  const reviewCount =
    typeof frontmatter.review_count === "number" ? frontmatter.review_count : 0;
  const sourceType =
    typeof frontmatter.source_type === "string" ? frontmatter.source_type : "";

  // Source note path from the wikilink (strip any |alias).
  const sourceLink =
    typeof frontmatter.source === "string"
      ? frontmatter.source.replace(/\[\[|\]\]/g, "").split("|")[0].trim()
      : "";

  const [commits, sourceFile] = await Promise.all([
    listCommits().catch(() => []),
    sourceLink.startsWith("10 Notes/")
      ? getFileViaTree(sourceLink.endsWith(".md") ? sourceLink : `${sourceLink}.md`).catch(() => null)
      : Promise.resolve(null),
  ]);

  const capturedDate = sourceFile
    ? toISODate(parseFrontmatter(sourceFile.content).frontmatter.date_ingested)
    : undefined;

  // Commits arrive newest-first, so the last matching event is the first review.
  const firstReviewDate = parseReviewEvents(commits)
    .filter((e) => e.slug === slug)
    .map((e) => e.date)
    .pop();

  const rows: JourneyRow[] = [];

  if (sourceDate) {
    const [icon, label] = SOURCE_LABEL[sourceType] || ["📚", "Source dated"];
    rows.push({ icon, text: `${label} ${monthYear(sourceDate)}` });
  }
  if (capturedDate) {
    rows.push({
      icon: "🌱",
      text: `Captured in your second brain ${timeAgo(capturedDate, today)}`,
    });
  }
  if (firstReviewDate && firstReviewDate !== reviewedDate) {
    rows.push({
      icon: "👀",
      text: `First reviewed ${timeAgo(firstReviewDate, today)}`,
    });
  }
  if (reviewedDate) {
    const visits = reviewCount === 1 ? "1 visit" : `${reviewCount} visits`;
    rows.push({
      icon: "🔁",
      text: `Last reviewed ${timeAgo(reviewedDate, today)} · ${visits}`,
    });
  }
  if (nextReviewDate && frontmatter.review_status === "reviewed") {
    const overdue = nextReviewDate <= today;
    rows.push({
      icon: overdue ? "⏰" : "📅",
      text: overdue
        ? "Due for review — perfect timing"
        : `Due again ${timeUntil(nextReviewDate, today)}`,
    });
  }

  const headline = journeyHeadline(reviewedDate, reviewCount, today);

  if (rows.length === 0 && !headline) return null;

  return (
    <aside className="journey">
      {headline && <p className="journey-headline">{headline}</p>}
      {rows.length > 0 && (
        <ul className="journey-rows">
          {rows.map((row, i) => (
            <li key={i} className="journey-row">
              <span className="journey-icon">{row.icon}</span>
              <span>{row.text}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

// One warm sentence that makes the gap feel like progress, not guilt.
function journeyHeadline(
  reviewedDate: string | undefined,
  reviewCount: number,
  today: string
): string | null {
  if (!reviewedDate) {
    return "A brand-new idea — give it its first look.";
  }
  const gap = daysBetween(reviewedDate, today);
  const since =
    gap <= 0
      ? "You were here earlier today"
      : gap === 1
        ? "It’s been a day since your last visit"
        : `It’s been ${spanLabel(gap)} since your last visit`;
  const visit = reviewCount + 1;
  const cheer =
    reviewCount >= 6
      ? `visit #${visit} — this one’s part of you now.`
      : reviewCount >= 3
        ? `visit #${visit} — it’s taking root.`
        : `welcome back for visit #${visit}.`;
  return `${since} — ${cheer}`;
}
