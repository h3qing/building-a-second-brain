import { listFiles, getFilesContent } from "./github";
import { parseFrontmatter, extractTitle, computeNextInterval, type Difficulty } from "./parser";
import { toISODate } from "./time";

export interface QueueItem {
  path: string;
  title: string;
  source: string;
  status: string;
  folder: string;
  nextReviewDate?: string;
  reviewCount?: number;
  reviewedDate?: string;
  reviewInterval?: number;
}

export interface CategorizedQueue {
  unreviewed: QueueItem[];
  contested: QueueItem[];
  reviewed: QueueItem[];
  dueForReview: QueueItem[];
}

// Short-lived in-memory cache. The card flow recomputes the queue on every card
// to find the next item (no giant queue in the URL), so reads must be cheap.
let cache: { items: QueueItem[]; at: number } | null = null;
const TTL = 15_000;

// All idea + concept notes that carry a review_status, in repo-tree order.
// The card flow reads cached (instant card-to-card navigation); the landing
// page passes forceFresh so review counts reflect a just-approved item.
export async function getReviewQueue(forceFresh = false): Promise<QueueItem[]> {
  const now = Date.now();
  if (!forceFresh && cache && now - cache.at < TTL) return cache.items;

  const [ideaPaths, conceptPaths] = await Promise.all([
    listFiles("20 Ideas"),
    listFiles("30 Concept"),
  ]);
  const allPaths = [...ideaPaths, ...conceptPaths];

  // An empty tree mid-session means GitHub errored (rate limit), not that the
  // vault is empty — serve the last known queue rather than zeroing out.
  if (allPaths.length === 0 && cache) return cache.items;

  const files = await getFilesContent(allPaths);

  const items: QueueItem[] = [];
  for (const path of allPaths) {
    const file = files.get(path);
    if (!file) continue;

    const { frontmatter, content } = parseFrontmatter(file.content);
    if (!frontmatter.review_status) continue;

    const folder = path.startsWith("20 Ideas") ? "Ideas" : "Concepts";
    const source =
      typeof frontmatter.source === "string"
        ? frontmatter.source.replace(/\[\[|\]\]/g, "").split("/").pop() || ""
        : "";

    items.push({
      path,
      title: extractTitle(content, path),
      source,
      status: frontmatter.review_status as string,
      folder,
      nextReviewDate: toISODate(frontmatter.next_review_date),
      reviewCount: frontmatter.review_count as number | undefined,
      reviewedDate: toISODate(frontmatter.reviewed_date),
      reviewInterval: frontmatter.review_interval as number | undefined,
    });
  }

  // Same guard for content fetches: don't clobber a good cache with a batch
  // of failed reads.
  if (items.length === 0 && cache && cache.items.length > 0) return cache.items;

  cache = { items, at: now };
  return items;
}

// Missing dates sort last so undated items don't jump the queue.
function byOldestReview(a: QueueItem, b: QueueItem): number {
  if (!a.reviewedDate) return b.reviewedDate ? 1 : 0;
  if (!b.reviewedDate) return -1;
  return a.reviewedDate.localeCompare(b.reviewedDate);
}

export function categorize(items: QueueItem[], today: string): CategorizedQueue {
  // Reviewed items surface by next due date; due items by how long it's been
  // since the last visit, so the longest-waiting ideas come up first.
  const reviewed = items
    .filter((i) => i.status === "reviewed")
    .sort((a, b) => (a.nextReviewDate || "").localeCompare(b.nextReviewDate || ""));
  return {
    unreviewed: items.filter((i) => i.status === "unreviewed"),
    contested: items.filter((i) => i.status === "contested"),
    reviewed,
    dueForReview: reviewed
      .filter((i) => i.nextReviewDate && i.nextReviewDate <= today)
      .sort(byOldestReview),
  };
}

// Patch the cached queue after a review commit so the very next card render
// (within the TTL) sees the new status. Without this the just-reviewed item
// re-appears in its old section and the session position resets to 1.
export function applyReviewToQueueCache(
  path: string,
  action: string,
  today: string
): void {
  const item = cache?.items.find((i) => i.path === path);
  if (!item || !cache) return;

  if (action === "contest") {
    item.status = "contested";
  } else if (action === "approve") {
    item.status = "reviewed";
    item.reviewedDate = today;
    if (!item.reviewCount) {
      item.reviewCount = 1;
      item.reviewInterval = 1;
      item.nextReviewDate = addDaysISO(today, 1);
    }
  } else if (action === "easy" || action === "medium" || action === "hard") {
    const nextInterval = computeNextInterval(
      item.reviewInterval || 1,
      action as Difficulty
    );
    item.status = "reviewed";
    item.reviewedDate = today;
    item.reviewCount = (item.reviewCount || 1) + 1;
    item.reviewInterval = nextInterval;
    item.nextReviewDate = addDaysISO(today, nextInterval);
  }
  // Refresh the TTL: the patched cache is now more accurate than an immediate
  // refetch (GitHub reads can lag the write by a moment).
  cache.at = Date.now();
}

function addDaysISO(iso: string, days: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

// The ordered list a card belongs to, used to find its prev/next during review.
// `mode` pins re-review; otherwise the queue is inferred from the item's status
// so navigation continues through the same section to the end.
export function queueForCard(
  items: QueueItem[],
  currentPath: string,
  mode: string | undefined,
  today: string
): QueueItem[] {
  const cat = categorize(items, today);
  if (mode === "rereview") return cat.dueForReview;

  for (const section of [cat.unreviewed, cat.contested, cat.dueForReview, cat.reviewed]) {
    if (section.some((i) => i.path === currentPath)) return section;
  }
  return cat.unreviewed;
}

// Card URL — just the path (+ mode); the queue is recomputed server-side.
// `done` counts cards completed this session so the "x of y" position keeps
// advancing even though reviewed cards drop out of the recomputed queue.
export function cardHref(path: string, mode?: string, done?: number): string {
  const params = new URLSearchParams({ path });
  if (mode) params.set("mode", mode);
  if (done && done > 0) params.set("done", String(done));
  return `/review/card?${params.toString()}`;
}
