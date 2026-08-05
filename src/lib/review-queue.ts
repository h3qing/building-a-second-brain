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
  starred?: boolean;
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

// Reviews patch the in-memory queue immediately, but the landing page rebuilds
// from GitHub (forceFresh) and GitHub's contents API can lag a commit by a few
// seconds. Without a bridge, that stale read resurrects a card the user just
// reviewed — the "I already reviewed these today" bug. Keep each applied review
// around long enough to outlast the lag and overlay it on any rebuild whose
// fetched data hasn't caught up yet.
interface ReviewPatch {
  status: string;
  reviewedDate?: string;
  reviewCount?: number;
  reviewInterval?: number;
  nextReviewDate?: string;
  isContest: boolean;
  at: number;
}
const recentReviews = new Map<string, ReviewPatch>();
// Reads are now tree-sha -> blob: a write purges the tree cache, but if the
// refetch still catches a pre-commit tree (GitHub read-after-write lag), that
// stale tree can be pinned for the full 15-min tree revalidate window. Keep
// patches long enough to outlast it; overlayRecentReviews drops each patch the
// moment the fetched data catches up, so the long TTL never masks real edits.
const PATCH_TTL = 960_000; // 16 min — tree revalidate window + margin

function overlayRecentReviews(items: QueueItem[]): void {
  const now = Date.now();
  for (const [path, patch] of recentReviews) {
    if (now - patch.at > PATCH_TTL) {
      recentReviews.delete(path);
      continue;
    }
    const item = items.find((i) => i.path === path);
    if (!item) continue;

    // Drop the patch once the fetched data reflects (or surpasses) the review,
    // so a stale-read bridge never clobbers a newer real edit.
    const caughtUp = patch.isContest
      ? item.status === patch.status
      : (item.reviewedDate || "") >= (patch.reviewedDate || "") &&
        (item.reviewCount || 0) >= (patch.reviewCount || 0);
    if (caughtUp) {
      recentReviews.delete(path);
      continue;
    }

    item.status = patch.status;
    if (!patch.isContest) {
      item.reviewedDate = patch.reviewedDate;
      item.reviewCount = patch.reviewCount;
      item.reviewInterval = patch.reviewInterval;
      item.nextReviewDate = patch.nextReviewDate;
    }
  }
}

// Idea notes that carry a review_status, in repo-tree order. Concepts are
// deliberately excluded: they're lean hub nodes (a one-line definition plus
// backlinks), so the spaced-repetition card has nothing to test recall on —
// they belong in their own flow. The card flow reads cached (instant
// card-to-card navigation); the landing page passes forceFresh so review
// counts reflect a just-approved item.
export async function getReviewQueue(forceFresh = false): Promise<QueueItem[]> {
  const now = Date.now();
  if (!forceFresh && cache && now - cache.at < TTL) return cache.items;

  const allPaths = await listFiles("20 Ideas");

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

    const folder = "Ideas";
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
      starred: frontmatter.starred === true,
    });
  }

  // Same guard for content fetches: don't clobber a good cache with a batch
  // of failed reads.
  if (items.length === 0 && cache && cache.items.length > 0) return cache.items;

  // Bridge GitHub's read-after-write lag: re-apply any just-reviewed items the
  // fresh read hasn't caught up to yet, so they don't resurface as "due".
  overlayRecentReviews(items);

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
  const reviewedAll = items.filter((i) => i.status === "reviewed");

  // An idea reviewed today is settled for the day — its next visit is in the
  // future, so it must not reappear in the actionable "due" list (the "already
  // reviewed today" bug). Due items surface by how long it's been since their
  // last visit, so the longest-waiting ideas come up first.
  const dueForReview = reviewedAll
    .filter(
      (i) =>
        i.nextReviewDate &&
        i.nextReviewDate <= today &&
        i.reviewedDate !== today
    )
    .sort(byOldestReview);

  // Keep due and reviewed disjoint so a due idea is listed once (in "Review
  // Again"), not echoed in the "Reviewed" log as a duplicate. Remaining
  // reviewed items surface by next due date.
  const duePaths = new Set(dueForReview.map((i) => i.path));
  const reviewed = reviewedAll
    .filter((i) => !duePaths.has(i.path))
    .sort((a, b) => (a.nextReviewDate || "").localeCompare(b.nextReviewDate || ""));

  return {
    unreviewed: items.filter((i) => i.status === "unreviewed"),
    contested: items.filter((i) => i.status === "contested"),
    reviewed,
    dueForReview,
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

  // Star toggles don't affect status or schedule — just flip the flag and let
  // the queue keep its current order.
  if (action === "star" || action === "unstar") {
    item.starred = action === "star";
    cache.at = Date.now();
    return;
  }

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

  // Remember the review so a forceFresh rebuild (the landing page) can re-apply
  // it while GitHub's read lags the commit, instead of resurrecting the card.
  recentReviews.set(path, {
    status: item.status,
    reviewedDate: item.reviewedDate,
    reviewCount: item.reviewCount,
    reviewInterval: item.reviewInterval,
    nextReviewDate: item.nextReviewDate,
    isContest: action === "contest",
    at: Date.now(),
  });
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
  // Re-review mode pins the due queue only when the card is actually due.
  // A reviewed-but-not-due card also runs in re-review mode (recall) but lives
  // in the `reviewed` section — fall through so its prev/next resolve there
  // instead of collapsing to a lone card.
  if (mode === "rereview" && cat.dueForReview.some((i) => i.path === currentPath)) {
    return cat.dueForReview;
  }

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
