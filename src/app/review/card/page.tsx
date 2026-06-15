import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { verifySession } from "@/lib/auth";
import { getFileContent } from "@/lib/github";
import { parseReviewItem } from "@/lib/parser";
import { getReviewQueue, queueForCard, cardHref } from "@/lib/review-queue";
import { ReviewCardForm } from "./insight-editor";
import { IdeaJourney } from "./journey";
import { reviewAction } from "@/app/review/action";

export default async function CardReview({
  searchParams,
}: {
  searchParams: Promise<{
    path?: string;
    next?: string;
    prev?: string;
    pos?: string;
    mode?: string;
    done?: string;
  }>;
}) {
  const isLoggedIn = await verifySession();

  const params = await searchParams;
  const currentPath = params.path;

  if (!currentPath) redirect("/review");

  const file = await getFileContent(currentPath);
  if (!file) redirect("/review");

  const item = await parseReviewItem(currentPath, file.sha, file.content);

  const isReReview =
    params.mode === "rereview" ||
    (typeof item.frontmatter.review_count === "number" &&
      item.frontmatter.review_count >= 1 &&
      item.frontmatter.review_status === "reviewed");

  // Active recall: re-reviews test recall by default; ?mode=recall forces it.
  const recallMode = params.mode === "recall" || isReReview;

  // Recompute the queue server-side to find this card's neighbours, so the
  // session flows through the whole queue instead of bouncing back to /review
  // after one card (the URL no longer carries the next/prev hops).
  const today = new Date().toISOString().split("T")[0];
  const navMode = isReReview ? "rereview" : params.mode;
  const queue = queueForCard(await getReviewQueue(), currentPath, navMode, today);
  const idx = queue.findIndex((i) => i.path === currentPath);
  const prevPath = idx > 0 ? queue[idx - 1].path : null;
  const nextPath =
    idx >= 0 && idx < queue.length - 1 ? queue[idx + 1].path : null;

  // Reviewed cards drop out of the recomputed queue, so the raw index resets
  // to 1 after every review. `done` counts this session's completed cards and
  // keeps both the position and the total steady.
  const done = Math.max(0, parseInt(params.done ?? "0", 10) || 0);
  const position = idx >= 0 ? `${done + idx + 1} of ${done + queue.length}` : "";

  // Reviewing removes this card from the queue: the next card shifts to the
  // front, so completing one increments `done` while navigation keeps it.
  const nextForAction = nextPath ? cardHref(nextPath, navMode, done + 1) : "/review";

  // Starring keeps you on the same card (it's not a review), so it returns here.
  const selfHref = cardHref(currentPath, navMode, done);
  const isStarred = item.frontmatter.starred === true;

  const pathParts = currentPath.split("/");
  const folder =
    pathParts.length >= 3 ? pathParts.slice(0, -1).join(" / ") : pathParts[0];

  // Extract the raw insight text (for persisting edits)
  const insightMatch = item.content.match(
    /##\s*Insight\s*\n([\s\S]*?)(?=\n##|$)/i
  );
  const aiInsight = insightMatch ? insightMatch[1].trim() : "";

  const insightParagraphs = aiInsight
    .replace(/!\[\[.*?\]\]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("## "))
    .map((line) => line.replace(/^[-*]\s*/, ""));

  return (
    <article className="space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between text-sm">
        <Link
          href="/review"
          className="text-muted hover:text-foreground transition-colors"
        >
          &larr; Queue
        </Link>
        {position && (
          <span className="text-muted tabular-nums font-mono">
            {position}
          </span>
        )}
      </div>

      {/* Title block */}
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="label">{folder}</div>
          {isLoggedIn && (
            <form action={reviewAction}>
              <input type="hidden" name="path" value={currentPath} />
              <input
                type="hidden"
                name="action"
                value={isStarred ? "unstar" : "star"}
              />
              <input type="hidden" name="returnTo" value={selfHref} />
              <input type="hidden" name="sha" value={item.sha} />
              <input type="hidden" name="rawContent" value={item.rawContent} />
              <button
                type="submit"
                className={`star-toggle${isStarred ? " is-starred" : ""}`}
                aria-label={isStarred ? "Remove star" : "Star this note"}
                title={isStarred ? "Starred" : "Star this note"}
              >
                {isStarred ? "★" : "☆"}
              </button>
            </form>
          )}
        </div>
        <h1
          className="font-heading tracking-tight leading-tight"
          style={{ fontSize: "2rem", fontWeight: 400 }}
        >
          {item.title}
        </h1>
      </header>

      {/* Journey timeline — the idea's life story, loads in after the card */}
      <Suspense fallback={null}>
        <IdeaJourney path={currentPath} frontmatter={item.frontmatter} />
      </Suspense>

      {/* Original Highlights */}
      {item.sourceHighlights.length > 0 && (
        <section className="space-y-3">
          <h2 className="label">Original Highlight</h2>
          {item.sourceHighlights.map((h, i) => (
            <blockquote
              key={i}
              className="border-l-2 pl-5 py-2 read"
              style={{
                borderColor: "var(--ink-accent)",
                background: "var(--highlight)",
                fontStyle: "italic",
              }}
            >
              <p>{h.text}</p>
              {h.location && (
                <p
                  className="text-xs text-muted font-mono"
                  style={{ marginTop: "0.5rem", fontStyle: "normal" }}
                >
                  {h.location}
                </p>
              )}
            </blockquote>
          ))}
        </section>
      )}

      {/* Insight editor + Action buttons (client component) */}
      <ReviewCardForm
        currentPath={currentPath}
        sha={item.sha}
        rawContent={item.rawContent}
        returnTo={nextForAction}
        isReReview={isReReview}
        aiInsight={aiInsight}
        insightParagraphs={insightParagraphs}
        isLoggedIn={isLoggedIn}
        recallMode={recallMode}
      />

      {/* Source Context */}
      {item.sourceContext.length > 0 && (
        <section className="space-y-3">
          <h2 className="label">Source Context</h2>
          {item.sourceContext.map((ctx, i) => (
            <blockquote
              key={i}
              className="border-l-2 pl-5 py-2 read"
              style={{
                borderColor: "var(--ink-accent)",
                background: "var(--highlight)",
                fontStyle: "italic",
              }}
            >
              {ctx.quote && <p>{ctx.quote}</p>}
              {ctx.timestampLabel && ctx.timestampUrl && (
                <a
                  href={ctx.timestampUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono inline-block"
                  style={{
                    color: "var(--ink-accent)",
                    marginTop: "0.5rem",
                    fontStyle: "normal",
                  }}
                >
                  {ctx.timestampLabel}
                </a>
              )}
            </blockquote>
          ))}
        </section>
      )}

      {/* Related Concepts */}
      {item.relatedConcepts.length > 0 && (
        <section>
          <h2 className="label mb-3">Related</h2>
          <div style={{ marginRight: "-0.5rem", marginBottom: "-0.5rem" }}>
            {item.relatedConcepts.map((concept) => (
              <span
                key={concept}
                className="inline-block text-xs px-2.5 py-1 border border-border text-muted rounded-sm font-mono"
                style={{ marginRight: "0.5rem", marginBottom: "0.5rem" }}
              >
                {concept}
              </span>
            ))}
          </div>
        </section>
      )}

      {nextPath && (
        <div className="text-center">
          <Link
            href={cardHref(nextPath, navMode, done)}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Skip for now &rarr;
          </Link>
        </div>
      )}

      {/* Prev / Next nav */}
      <nav
        className="flex items-center justify-between pt-5 border-t border-border"
      >
        {prevPath ? (
          <Link href={cardHref(prevPath, navMode, done)} className="btn btn-nav">
            &larr; Prev
          </Link>
        ) : (
          <span />
        )}
        {nextPath ? (
          <Link href={cardHref(nextPath, navMode, done)} className="btn btn-nav">
            Next &rarr;
          </Link>
        ) : (
          <Link href="/review" className="btn btn-nav">
            Done
          </Link>
        )}
      </nav>
    </article>
  );
}
