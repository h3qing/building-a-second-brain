import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { verifySession } from "@/lib/auth";
import { getFileContent } from "@/lib/github";
import {
  parseReviewItem,
  computeNextInterval,
  elapsedSince,
  type Difficulty,
} from "@/lib/parser";
import { getReviewQueue, queueForCard, cardHref } from "@/lib/review-queue";
import { todayISO, shortSpan } from "@/lib/time";
import { ReviewCardForm } from "./insight-editor";
import { RecallProvider, AfterReveal } from "./recall";
import { IdeaJourney } from "./journey";
import { SourceCard } from "./source-card";
import { reviewAction } from "@/app/review/action";

function headline(text: string) {
  return (
    <h1
      className="font-heading tracking-tight leading-tight"
      style={{ fontSize: "2rem", fontWeight: 400 }}
    >
      {text}
    </h1>
  );
}

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
  // The card view fetches and renders raw vault files (including their full
  // source text), so it is only available to the authenticated owner.
  if (!isLoggedIn) redirect("/login");

  const params = await searchParams;
  const currentPath = params.path;

  if (!currentPath) redirect("/review");
  // Cards only ever live under the ideas/concepts folders; reject anything
  // else so this page can't be used to read arbitrary vault files.
  if (
    !/^(20 Ideas|30 Concept)\/.+\.md$/.test(currentPath) ||
    currentPath.includes("..")
  ) {
    redirect("/review");
  }

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
  const today = todayISO();
  // A daily session keeps its own running order across new and due cards.
  const navMode =
    params.mode === "session" ? "session" : isReReview ? "rereview" : params.mode;
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
  // The last card of a daily session lands on its summary.
  const nextForAction = nextPath
    ? cardHref(nextPath, navMode, done + 1)
    : navMode === "session"
      ? `/review?completed=${done + 1}`
      : "/review";

  // The recall cue: a written question beats the highlight, which beats the
  // bare title. With a question, the title and highlight become part of the
  // answer and stay hidden until reveal.
  const cue = item.recallQuestion
    ? "question"
    : item.sourceHighlights.length > 0
      ? "highlight"
      : "title";

  // What each rating would schedule, shown on its button so the spacing is
  // visible before you commit to it.
  const currentInterval =
    typeof item.frontmatter.review_interval === "number"
      ? item.frontmatter.review_interval
      : 1;
  const elapsed = elapsedSince(item.frontmatter.reviewed_date, today);
  const ratingHints = Object.fromEntries(
    (["easy", "medium", "hard", "forgot"] as Difficulty[]).map((d) => [
      d,
      shortSpan(computeNextInterval(currentInterval, d, elapsed)),
    ])
  );

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

  const highlights = (
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
  );

  return (
    <RecallProvider key={currentPath} recallMode={recallMode}>
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
          {cue === "question" ? (
            // The title states the idea, i.e. the answer — ask the question
            // in its place until reveal.
            <AfterReveal before={headline(item.recallQuestion)}>
              {headline(item.title)}
            </AfterReveal>
          ) : (
            headline(item.title)
          )}
        </header>

        {/* Where this idea comes from — cover, title, author. Loads in after
            the card so the source lookup never blocks first paint. */}
        <Suspense fallback={null}>
          <SourceCard frontmatter={item.frontmatter} path={currentPath} />
        </Suspense>

        {/* Journey timeline — the idea's life story, loads in after the card */}
        <Suspense fallback={null}>
          <IdeaJourney path={currentPath} frontmatter={item.frontmatter} />
        </Suspense>

        {/* Original Highlights — the cue when there's no question, part of the
            answer when there is */}
        {item.sourceHighlights.length > 0 &&
          (cue === "question" ? (
            <AfterReveal>{highlights}</AfterReveal>
          ) : (
            highlights
          ))}

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
          cue={cue}
          recallQuestion={item.recallQuestion}
          prevHref={prevPath ? cardHref(prevPath, navMode, done) : null}
          nextHref={nextPath ? cardHref(nextPath, navMode, done) : null}
          ratingHints={ratingHints}
        />

        {/* Source Context + Related — the quote usually states the insight
            outright, so both wait for reveal */}
        <AfterReveal>
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
        </AfterReveal>

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
    </RecallProvider>
  );
}
