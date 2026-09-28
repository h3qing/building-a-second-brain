import Link from "next/link";
import { verifySession } from "@/lib/auth";
import {
  getReviewQueue,
  categorize,
  cardHref,
  todaysSession,
  forecast,
  type QueueItem,
} from "@/lib/review-queue";
import { spanLabel, daysBetween, timeUntil, todayISO } from "@/lib/time";
import { ReviewStats } from "@/app/components/ReviewStats";
import { DueForecast } from "@/app/components/DueForecast";
import { reviewAction } from "@/app/review/action";
import { StarredFilter } from "./starred-filter";

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
  isLoggedIn,
}: {
  title: string;
  subtitle?: string;
  groups: SourceGroup[];
  mode?: string;
  tone?: "accent" | "danger" | "muted";
  meta?: (item: QueueItem) => string | null;
  isLoggedIn: boolean;
}) {
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);
  const toneStyle =
    tone === "danger"
      ? { color: "var(--danger)" }
      : tone === "muted"
        ? { color: "var(--ink-muted)" }
        : { color: "var(--ink-accent)" };

  return (
    <section className="rq-section">
      <h2 className={subtitle ? "label mb-1" : "label mb-4"} style={toneStyle}>
        {title}{" "}
        <span className="rq-section-count">({totalCount})</span>
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
                  // The star form sits beside the <Link>, not inside it: a
                  // <button> nested in an <a> is invalid and would hijack the
                  // card's navigation. The wrapper positions the star over the
                  // card corner; `data-starred` drives the starred filter.
                  return (
                    <div
                      key={item.path}
                      className="rq-card-wrap"
                      data-starred={item.starred ? "true" : "false"}
                    >
                      <Link
                        href={cardHref(item.path, mode)}
                        className={`rq-card rq-card-${group.type}`}
                      >
                        <span className="rq-card-title">{item.title}</span>
                        {metaText && (
                          <span className="rq-card-meta">{metaText}</span>
                        )}
                      </Link>
                      {isLoggedIn ? (
                        <form action={reviewAction} className="rq-star-form">
                          <input type="hidden" name="path" value={item.path} />
                          <input
                            type="hidden"
                            name="action"
                            value={item.starred ? "unstar" : "star"}
                          />
                          <input type="hidden" name="returnTo" value="/review" />
                          <button
                            type="submit"
                            className={`rq-star-btn${item.starred ? " is-starred" : ""}`}
                            aria-label={
                              item.starred ? "Remove star" : "Star this note"
                            }
                            title={item.starred ? "Starred" : "Star this note"}
                          >
                            {item.starred ? "★" : "☆"}
                          </button>
                        </form>
                      ) : (
                        item.starred && (
                          <span className="rq-star-static" aria-label="Starred">
                            ★
                          </span>
                        )
                      )}
                    </div>
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

export default async function ReviewQueue({
  searchParams,
}: {
  searchParams: Promise<{ completed?: string }>;
}) {
  const isLoggedIn = await verifySession();
  // Set by the last card of a daily session: how many cards it went through.
  const completed = Math.max(0, parseInt((await searchParams).completed ?? "", 10) || 0);

  const today = todayISO();
  const allItems = await getReviewQueue(true);
  const { unreviewed, contested, reviewed, dueForReview } = categorize(
    allItems,
    today
  );

  const starredCount = allItems.filter((i) => i.starred).length;

  // "it's been 3 weeks" — how long an idea has waited since its last visit
  const sinceReview = (item: QueueItem) =>
    item.reviewedDate
      ? `it's been ${spanLabel(daysBetween(item.reviewedDate, today))}`
      : null;

  // "back in 2 weeks" — when a reviewed idea returns to the queue
  const backWhen = (item: QueueItem) =>
    item.nextReviewDate ? `back ${timeUntil(item.nextReviewDate, today)}` : null;

  // One button runs today's session: due cards first (they're fading right
  // now), then new ideas up to the daily limit.
  const session = todaysSession(allItems, today);
  const startHref = !isLoggedIn
    ? "/login"
    : session.cards.length > 0
      ? cardHref(session.cards[0].path, "session")
      : null;
  const startCta = !isLoggedIn ? "Sign in to review" : "Start today\u2019s review";

  // What today's reviews produced, for the end-of-session summary.
  const reviewedToday = allItems.filter((i) => i.reviewedDate === today);
  const forgotToday = reviewedToday.filter((i) => i.difficulty === "forgot").length;
  const upcoming = forecast(allItems, today);

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

        {isLoggedIn && session.cards.length > 0 && (
          <p className="text-sm text-muted">
            Today: {session.due.length} due + {session.fresh.length} new
            {session.newWaiting > 0 &&
              ` · ${session.newWaiting} more new waiting (${session.newLimit}/day)`}
          </p>
        )}

        {isLoggedIn &&
          session.cards.length === 0 &&
          session.newWaiting > 0 &&
          unreviewed.length > 0 && (
            <p className="text-sm text-muted">
              Today&apos;s {session.newLimit} new ideas are done; {session.newWaiting}{" "}
              more wait for tomorrow. Spacing them out keeps future review days
              light.{" "}
              <Link
                href={cardHref(unreviewed[0].path)}
                className="underline hover:text-foreground"
              >
                Keep going anyway &rarr;
              </Link>
            </p>
          )}
      </header>

      {isLoggedIn && completed > 0 && (
        <section className="session-done">
          <p className="font-heading" style={{ fontSize: "1.25rem" }}>
            Session complete: {completed} {completed === 1 ? "card" : "cards"}.
          </p>
          <p className="text-sm text-muted">
            {reviewedToday.length} reviewed today
            {session.newSeenToday > 0 && ` · ${session.newSeenToday} new`}
            {forgotToday > 0 && ` · ${forgotToday} forgot (back tomorrow)`}
            {upcoming[0].count > 0
              ? ` · ${upcoming[0].count} due tomorrow`
              : " · nothing due tomorrow"}
          </p>
        </section>
      )}

      {isLoggedIn && <DueForecast days={upcoming} />}

      {isLoggedIn && <ReviewStats />}

      <StarredFilter count={starredCount}>
        {unreviewed.length > 0 && (
          <CardSection
            title="Needs Review"
            groups={groupBySource(unreviewed)}
            tone="accent"
            isLoggedIn={isLoggedIn}
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
            isLoggedIn={isLoggedIn}
          />
        )}

        {contested.length > 0 && (
          <CardSection
            title="Contested"
            groups={groupBySource(contested)}
            tone="danger"
            isLoggedIn={isLoggedIn}
          />
        )}

        {reviewed.length > 0 && (
          <CardSection
            title="Reviewed"
            groups={groupBySource(reviewed)}
            tone="muted"
            meta={backWhen}
            isLoggedIn={isLoggedIn}
          />
        )}
      </StarredFilter>

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
        contested.length === 0 &&
        dueForReview.length === 0 && (
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
