import { listFiles, getFilesContent } from "./github";
import { parseFrontmatter, extractTitle } from "./parser";

export interface QueueItem {
  path: string;
  title: string;
  source: string;
  status: string;
  folder: string;
  nextReviewDate?: string;
  reviewCount?: number;
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
      nextReviewDate: frontmatter.next_review_date as string | undefined,
      reviewCount: frontmatter.review_count as number | undefined,
    });
  }

  cache = { items, at: now };
  return items;
}

export function categorize(items: QueueItem[], today: string): CategorizedQueue {
  const reviewed = items.filter((i) => i.status === "reviewed");
  return {
    unreviewed: items.filter((i) => i.status === "unreviewed"),
    contested: items.filter((i) => i.status === "contested"),
    reviewed,
    dueForReview: reviewed.filter(
      (i) => i.nextReviewDate && i.nextReviewDate <= today
    ),
  };
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
export function cardHref(path: string, mode?: string): string {
  const params = new URLSearchParams({ path });
  if (mode) params.set("mode", mode);
  return `/review/card?${params.toString()}`;
}
