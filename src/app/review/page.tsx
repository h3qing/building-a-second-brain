import Link from "next/link";
import { verifySession } from "@/lib/auth";
import {
  getReviewQueue,
  categorize,
  cardHref,
  type QueueItem,
} from "@/lib/review-queue";
import { spanLabel, daysBetween, timeUntil } from "@/lib/time";
import { ReviewStats } from "@/app/components/ReviewStats";

interface SourceGroup {
  source: string;
  type: "book" | "podcast" | "concept";
  items: QueueItem[];
}

// `byWait` orders groups by their longest-waiting item (items are already
// time-sorted by categorize), so the most neglected source floats up.
function groupBySource(items: QueueItem[], byWait = false): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();

  for (const item of items) {
    const key = item.source || "Concepts";
    const type: SourceGroup["type"] =
      item.folder === "Concepts"
        ? "concept"
        : item.path.includes("Podcasts/")
          ? "podcast"
          : "book";

    if (!groups.has(key)) {
      groups.set(key, { source: key, type, items: [] });
    }
    groups.get(key)!.items.push(item);
  }

  if (byWait) return [...groups.values()];

  return [...groups.values()].sort((a, b) => {
    if (a.type === "concept") return 1;
    if (b.type === "concept") return -1;
    if (a.type === "podcast" && b.type !== "podcast") return -1;
    if (a.type !== "podcast" && b.type === "podcast") return 1;
    return b.items.length - a.items.length;
  });
}

function Stat({ count, label }: { count: number; label: string }) {
  return (
    <div className="inline-block" style={{ marginRight: "2rem", marginBottom: "0.5rem" }}>
      <div className="text-3xl font-heading leading-none">{count}</div>
      <div className="label mt-1.5">{label}</div>
    </div>
  );
}

const SOURCE_ICONS: Record<string, string> = {
  podcast: "\uD83C\uDF99",
  book: "\uD83D\uDCD6",
  concept: "\uD83D\uDCDD",
};

function CardSection({
  title,
  subtitle,
  groups,
  mode,
  tone,
  meta,
}: {
  title: string;
  subtitle?: string;
  groups: SourceGroup[];
  mode?: string;
  tone?: "accent" | "danger" | "muted";
  meta?: (item: QueueItem) => string | null;
}) {
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);
  const toneStyle =
    tone === "danger"
      ? { color: "var(--danger)" }
      : tone === "muted"
        ? { color: "var(--ink-muted)" }
        : { color: "var(--ink-accent)" };

  return (
    <section>
      <h2 className={subtitle ? "label mb-1" : "label mb-4"} style={toneStyle}>
        {title} ({totalCount})
      </h2>
      {subtitle && (
        <p className="text-sm text-muted mb-4" style={{ fontStyle: "italic" }}>
          {subtitle}
        </p>
      )}
      <div className="rq-breakout">
        <div className="rq-inner">
          {groups.map((group) => (
            <div key={group.source} className="rq-source-group">
              <div className="rq-source-header">
                <span>{SOURCE_ICONS[group.type] || "\uD83D\uDCD6"}</span>
                <span className="rq-source-name">{group.source}</span>
                <span className="rq-source-count">{group.items.length}</span>
              </div>
              <div className="rq-card-grid">
                {group.items.map((item) => {
                  const metaText = meta ? meta(item) : null;
                  return (
                    <Link
                      key={item.path}
                      href={cardHref(item.path, mode)}
                      className={`rq-card rq-card-${group.type}`}
                    >
                      <span className="rq-card-title">{item.title}</span>
                      {metaText && (
                        <span className="rq-card-meta">{metaText}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function ReviewQueue() {
  const isLoggedIn = await verifySession();

  const today = new Date().toISOString().split("T")[0];
  const allItems = await getReviewQueue(true);
  const { unreviewed, contested, reviewed, dueForReview } = categorize(
    allItems,
    today
  );

  // "it's been 3 weeks" — how long an idea has waited since its last visit
  const sinceReview = (item: QueueItem) =>
    item.reviewedDate
      ? `it's been ${spanLabel(daysBetween(item.reviewedDate, today))}`
      : null;

  // "back in 2 weeks" — when a reviewed idea returns to the queue
  const backWhen = (item: QueueItem) =>
    item.nextReviewDate ? `back ${timeUntil(item.nextReviewDate, today)}` : null;

  const startHref = isLoggedIn
    ? unreviewed.length > 0
      ? cardHref(unreviewed[0].path)
      : null
    : "/login";
  const startCta = isLoggedIn ? "Start Reviewing" : "Sign in to review";

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-heading tracking-tight">
            Review Queue
          </h1>
          {startHref && (
            <Link
              href={startHref}
              className="btn bg-foreground text-background border-foreground text-sm whitespace-nowrap"
              style={{ marginLeft: "1rem" }}
            >
              {startCta}
            </Link>
          )}
        </div>

        {!isLoggedIn && (
          <p className="text-sm text-muted">
            Browsing as a guest. Queue is read-only — sign in to approve or contest items.
          </p>
        )}

        <div className="flex flex-wrap">
          <Stat count={unreviewed.length} label="unreviewed" />
          {dueForReview.length > 0 && (
            <Stat count={dueForReview.length} label="due again" />
          )}
          <Stat count={contested.length} label="contested" />
          <Stat count={reviewed.length} label="reviewed" />
        </div>
      </header>

      {isLoggedIn && <ReviewStats />}

      {unreviewed.length > 0 && (
        <CardSection
          title="Needs Review"
          groups={groupBySource(unreviewed)}
          tone="accent"
        />
      )}

      {dueForReview.length > 0 && (
        <CardSection
          title="Review Again"
          subtitle="Longest-waiting ideas first — give them some love."
          groups={groupBySource(dueForReview, true)}
          mode="rereview"
          tone="accent"
          meta={sinceReview}
        />
      )}

      {contested.length > 0 && (
        <CardSection
          title="Contested"
          groups={groupBySource(contested)}
          tone="danger"
        />
      )}

      {reviewed.length > 0 && (
        <CardSection
          title="Reviewed"
          groups={groupBySource(reviewed)}
          tone="muted"
          meta={backWhen}
        />
      )}

      {allItems.length === 0 ? (
        // The vault always has notes once it's seeded — an empty fetch usually
        // means GitHub rate-limited us mid-session, not an empty queue.
        <div className="text-center py-16 text-muted">
          <p className="text-lg mb-2">Couldn&apos;t load the queue.</p>
          <p className="text-sm">
            GitHub may be catching its breath (rate limit). Your reviews are
            saved — refresh in a minute.
          </p>
        </div>
      ) : (
        unreviewed.length === 0 &&
        contested.length === 0 && (
          <div className="text-center py-16 text-muted">
            <p className="text-lg mb-2">All caught up.</p>
            <p className="text-sm">
              Nothing to review. Ingest more sources in Claude Code.
            </p>
          </div>
        )
      )}
    </div>
  );
}
