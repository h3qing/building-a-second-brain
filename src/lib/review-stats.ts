import { listCommits, type CommitSummary } from "./github";
import { addDaysISO, localISODate, todayISO } from "./time";

export interface ReviewEvent {
  date: string; // YYYY-MM-DD, in APP_TIMEZONE
  slug: string;
  action: "approve" | "contest" | "easy" | "medium" | "hard" | "forgot";
}

export interface HeatmapCell {
  date: string;
  count: number; // unique ideas reviewed that day
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ReviewStatsData {
  totalUnique: number;
  approves: number;
  contests: number;
  reviewsThisWeek: number;
  reviewsThisMonth: number;
  streak: { current: number; longest: number; lastDate: string | null };
  heatmap: { weeks: HeatmapCell[][]; start: string; end: string };
}

// Matches: review: approve "slug"  OR  review: easy "slug"
const REVIEW_RE =
  /^review:\s+(approve|contest|easy|medium|hard|forgot)\s+"([^"]+)"/i;

export function parseReviewEvents(commits: CommitSummary[]): ReviewEvent[] {
  const events: ReviewEvent[] = [];
  for (const c of commits) {
    const firstLine = c.message.split("\n", 1)[0];
    const m = firstLine.match(REVIEW_RE);
    if (!m) continue;
    events.push({
      // The reader's calendar day, not UTC's (see APP_TIMEZONE).
      date: localISODate(new Date(c.date)),
      slug: m[2],
      action: m[1].toLowerCase() as ReviewEvent["action"],
    });
  }
  return events;
}

function uniqueSlugsByDay(events: ReviewEvent[]): Map<string, Set<string>> {
  const byDay = new Map<string, Set<string>>();
  for (const e of events) {
    let set = byDay.get(e.date);
    if (!set) {
      set = new Set();
      byDay.set(e.date, set);
    }
    set.add(e.slug);
  }
  return byDay;
}

function computeStreak(
  byDay: Map<string, Set<string>>,
  today: string
): {
  current: number;
  longest: number;
  lastDate: string | null;
} {
  const dates = [...byDay.keys()].sort();
  if (dates.length === 0) return { current: 0, longest: 0, lastDate: null };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    if (addDaysISO(dates[i - 1], 1) === dates[i]) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const lastDate = dates[dates.length - 1];
  let current = 0;
  // Grace window: allow today to be empty (haven't reviewed yet today).
  if (lastDate === today || lastDate === addDaysISO(today, -1)) {
    current = 1;
    for (let i = dates.length - 2; i >= 0; i--) {
      if (addDaysISO(dates[i], 1) === dates[i + 1]) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { current, longest, lastDate };
}

function bucketLevel(count: number): HeatmapCell["level"] {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

// First/last day of the 52-week × 7-day grid ending this week (Sunday-start
// columns). Pure calendar math on YYYY-MM-DD strings.
function heatmapBounds(today: string): { start: string; end: string } {
  const dow = new Date(today + "T00:00:00Z").getUTCDay(); // 0 = Sun
  const end = addDaysISO(today, 6 - dow);
  return { start: addDaysISO(end, -(52 * 7 - 1)), end };
}

function buildHeatmap(
  byDay: Map<string, Set<string>>,
  today: string
): {
  weeks: HeatmapCell[][];
  start: string;
  end: string;
} {
  const bounds = heatmapBounds(today);
  const gridStart = new Date(bounds.start + "T00:00:00Z");

  const weeks: HeatmapCell[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 52; w++) {
    const week: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = cursor.toISOString().slice(0, 10);
      const isFuture = iso > today;
      const count = isFuture ? 0 : byDay.get(iso)?.size ?? 0;
      week.push({ date: iso, count, level: isFuture ? 0 : bucketLevel(count) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks, start: bounds.start, end: bounds.end };
}

// Everything here covers the heatmap's 52 weeks — the window whose commits are
// fetched. Fetching starts a day early so a timezone ahead of UTC doesn't clip
// the first local day; events before the window are then dropped.
export async function getReviewStats(): Promise<ReviewStatsData> {
  const today = todayISO();
  const grid = heatmapBounds(today);
  const commits = await listCommits({
    since: `${addDaysISO(grid.start, -1)}T00:00:00Z`,
  });
  const events = parseReviewEvents(commits).filter(
    (e) => e.date >= grid.start
  );
  const byDay = uniqueSlugsByDay(events);

  const totalUnique = new Set(events.map((e) => e.slug)).size;
  const approves = events.filter((e) => e.action === "approve").length;
  const contests = events.filter((e) => e.action === "contest").length;

  const weekAgo = addDaysISO(today, -6);
  const monthAgo = addDaysISO(today, -29);

  let reviewsThisWeek = 0;
  let reviewsThisMonth = 0;
  for (const [date, slugs] of byDay) {
    if (date >= weekAgo && date <= today) reviewsThisWeek += slugs.size;
    if (date >= monthAgo && date <= today) reviewsThisMonth += slugs.size;
  }

  return {
    totalUnique,
    approves,
    contests,
    reviewsThisWeek,
    reviewsThisMonth,
    streak: computeStreak(byDay, today),
    heatmap: buildHeatmap(byDay, today),
  };
}
