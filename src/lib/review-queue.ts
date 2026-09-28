import { listFiles, getFilesContent } from "./github";
import {
  parseFrontmatter,
  extractTitle,
  extractRelatedConcepts,
  computeNextInterval,
  elapsedSince,
  type Difficulty,
} from "./parser";
import { extractSection } from "./markdown";
import { toISODate, addDaysISO } from "./time";

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
  difficulty?: string; // last rating: easy | medium | hard | forgot
  lapses?: number;
  starred?: boolean;
  concepts: string[]; // Related Concepts, normalized (see conceptKey)
  insight: string; // short excerpt, for connection prompts
  // Time-bound claims: what was predicted, when it can be judged, and — once
  // checked — how it turned out.
  prediction?: string;
  verifyBy?: string;
  sourceDate?: string;
  predictionOutcome?: string;
}

export interface CategorizedQueue {
  unreviewed: QueueItem[];
  contested: QueueItem[];
  reviewed: QueueItem[];
  dueForReview: QueueItem[];
}

// "[[10 Notes/x/Negotiation|negotiation]]" and "Negotiation" name the same
// concept: compare by lowercased filename.
export function conceptKey(link: string): string {
  return (link.split("|")[0].split("/").pop() || "").trim().toLowerCase();
}

function excerpt(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
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
  difficulty?: string;
  lapses?: number;
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

// The same read-after-write bridge for prediction checks, so a just-judged
// prediction doesn't reappear as "to check" on the next stale read.
const recentChecks = new Map<string, { outcome: string; at: number }>();

function overlayRecentChecks(items: QueueItem[]): void {
  const now = Date.now();
  for (const [path, check] of recentChecks) {
    const item = items.find((i) => i.path === path);
    if (now - check.at > PATCH_TTL || item?.predictionOutcome === check.outcome) {
      recentChecks.delete(path);
    } else if (item) {
      item.predictionOutcome = check.outcome;
    }
  }
}

export function applyCheckToQueueCache(path: string, outcome: string): void {
  const item = cache?.items.find((i) => i.path === path);
  if (item && cache) {
    item.predictionOutcome = outcome;
    cache.at = Date.now();
  }
  recentChecks.set(path, { outcome, at: Date.now() });
}

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
    item.reviewedDate = patch.reviewedDate;
    if (!patch.isContest) {
      item.reviewCount = patch.reviewCount;
      item.reviewInterval = patch.reviewInterval;
      item.nextReviewDate = patch.nextReviewDate;
      item.difficulty = patch.difficulty;
      item.lapses = patch.lapses;
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
      difficulty:
        typeof frontmatter.difficulty === "string"
          ? frontmatter.difficulty
          : undefined,
      lapses: typeof frontmatter.lapses === "number" ? frontmatter.lapses : 0,
      starred: frontmatter.starred === true,
      concepts: extractRelatedConcepts(content).map(conceptKey),
      insight: excerpt(extractSection(content, "Insight"), 160),
      prediction:
        typeof frontmatter.prediction === "string" && frontmatter.prediction.trim()
          ? frontmatter.prediction.trim()
          : undefined,
      verifyBy: toISODate(frontmatter.verify_by),
      sourceDate: toISODate(frontmatter.source_date),
      predictionOutcome:
        typeof frontmatter.prediction_outcome === "string"
          ? frontmatter.prediction_outcome
          : undefined,
    });
  }

  // Same guard for content fetches: don't clobber a good cache with a batch
  // of failed reads.
  if (items.length === 0 && cache && cache.items.length > 0) return cache.items;

  // Bridge GitHub's read-after-write lag: re-apply any just-reviewed items the
  // fresh read hasn't caught up to yet, so they don't resurface as "due".
  overlayRecentReviews(items);
  overlayRecentChecks(items);

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

// New ideas per day. Each idea learned today comes back roughly eight times
// over the next months, so this rate — not willpower — sets how big every
// future day's review load gets. Override with DAILY_NEW_LIMIT.
export function dailyNewLimit(): number {
  const n = parseInt(process.env.DAILY_NEW_LIMIT || "", 10);
  return n > 0 ? n : 10;
}

export interface Session {
  due: QueueItem[];
  fresh: QueueItem[]; // today's share of new ideas
  cards: QueueItem[]; // due first, then fresh — the session's running order
  newSeenToday: number;
  newLimit: number;
  newWaiting: number; // new ideas beyond today's limit
}

// Today's session: every due card first (they're fading right now), then new
// ideas up to the daily limit. Recomputed on every card — a reviewed card
// drops out, and a new idea seen today shrinks the allowance by one, so the
// session's end stays fixed while it runs.
export function todaysSession(
  items: QueueItem[],
  today: string,
  newLimit = dailyNewLimit()
): Session {
  const { unreviewed, dueForReview } = categorize(items, today);
  // First looks today: approved today for the first time, or contested today.
  const newSeenToday = items.filter(
    (i) =>
      i.reviewedDate === today &&
      (i.status === "contested" ||
        (i.status === "reviewed" && (i.reviewCount || 0) <= 1))
  ).length;
  const fresh = unreviewed.slice(0, Math.max(0, newLimit - newSeenToday));
  return {
    due: dueForReview,
    fresh,
    cards: [...dueForReview, ...fresh],
    newSeenToday,
    newLimit,
    newWaiting: unreviewed.length - fresh.length,
  };
}

// Reviewed ideas coming due on each of the next `days` days.
export function forecast(
  items: QueueItem[],
  today: string,
  days = 7
): Array<{ date: string; count: number }> {
  const counts = new Map<string, number>();
  for (const i of items) {
    if (i.status !== "reviewed" || !i.nextReviewDate) continue;
    counts.set(i.nextReviewDate, (counts.get(i.nextReviewDate) || 0) + 1);
  }
  return Array.from({ length: days }, (_, k) => {
    const date = addDaysISO(today, k + 1);
    return { date, count: counts.get(date) || 0 };
  });
}

// Predictions whose check-by date has arrived and that haven't been judged,
// oldest deadline first.
export function predictionsDue(items: QueueItem[], today: string): QueueItem[] {
  return items
    .filter(
      (i) => i.prediction && i.verifyBy && i.verifyBy <= today && !i.predictionOutcome
    )
    .sort((a, b) => (a.verifyBy || "").localeCompare(b.verifyBy || ""));
}

// Your calibration so far: how the predictions you kept turned out.
export function predictionTally(items: QueueItem[], today: string) {
  const withClaim = items.filter((i) => i.prediction && i.verifyBy);
  const open = withClaim.filter((i) => !i.predictionOutcome);
  const count = (o: string) =>
    withClaim.filter((i) => i.predictionOutcome === o).length;
  return {
    cameTrue: count("came-true"),
    partly: count("partly"),
    wrong: count("wrong"),
    open: open.length,
    nextCheck: open
      .map((i) => i.verifyBy!)
      .filter((d) => d > today)
      .sort()[0],
  };
}

export interface Connection {
  item: QueueItem;
  concept: string; // the shared concept, as the current card names it
  sameSource: boolean;
}

// Ideas that share a concept with this card, for a "how do these relate?"
// prompt after reveal. Reviewed ideas from *other* sources come first — that
// cross-source link is the synthesis the concept graph exists for; same-source
// siblings only fill in when nothing else shares a concept. The pick varies
// by card but is stable across reloads.
export function findConnections(
  items: QueueItem[],
  current: { path: string; source: string; concepts: string[] },
  max = 2
): Connection[] {
  const mine = new Map(current.concepts.map((c) => [conceptKey(c), c]));
  if (mine.size === 0) return [];

  const scored = items
    .filter((i) => i.path !== current.path && i.status === "reviewed")
    .map((i) => {
      // Shared concepts in this card's order, so the one named is predictable.
      const shared = [...mine.keys()].filter((k) => i.concepts.includes(k));
      return {
        item: i,
        shared,
        sameSource: i.source === current.source,
        tiebreak: hashString(current.path + "\u0000" + i.path),
      };
    })
    .filter((x) => x.shared.length > 0)
    .sort(
      (a, b) =>
        Number(a.sameSource) - Number(b.sameSource) ||
        b.shared.length - a.shared.length ||
        a.tiebreak - b.tiebreak
    );

  return scored.slice(0, max).map((x) => ({
    item: x.item,
    concept: mine.get(x.shared[0]) || x.shared[0],
    sameSource: x.sameSource,
  }));
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
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
    // The file gets reviewed_date too; mirror it so a contested new idea
    // counts against today's new-card allowance right away.
    item.status = "contested";
    item.reviewedDate = today;
  } else if (action === "approve") {
    item.status = "reviewed";
    item.reviewedDate = today;
    if (!item.reviewCount) {
      item.reviewCount = 1;
      item.reviewInterval = 1;
      item.nextReviewDate = addDaysISO(today, 1);
    }
  } else if (
    action === "easy" ||
    action === "medium" ||
    action === "hard" ||
    action === "forgot"
  ) {
    // Same schedule as the committed file: elapsed is measured from the
    // previous review, before this one overwrites reviewedDate below.
    const nextInterval = computeNextInterval(
      item.reviewInterval || 1,
      action as Difficulty,
      elapsedSince(item.reviewedDate, today)
    );
    item.status = "reviewed";
    item.reviewedDate = today;
    item.reviewCount = (item.reviewCount || 1) + 1;
    item.reviewInterval = nextInterval;
    item.nextReviewDate = addDaysISO(today, nextInterval);
    item.difficulty = action;
    if (action === "forgot") item.lapses = (item.lapses || 0) + 1;
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
    difficulty: item.difficulty,
    lapses: item.lapses,
    isContest: action === "contest",
    at: Date.now(),
  });
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
  // A daily session runs due-then-new across sections. A card that isn't in
  // it (opened from a list mid-session) falls back to its own section.
  if (mode === "session") {
    const { cards } = todaysSession(items, today);
    if (cards.some((i) => i.path === currentPath)) return cards;
  }

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
