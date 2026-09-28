import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { verifySession } from "@/lib/auth";
import { getFileContent, listFiles } from "@/lib/github";
import {
  parseReviewItem,
  computeNextInterval,
  elapsedSince,
  type Difficulty,
} from "@/lib/parser";
import {
  getReviewQueue,
  queueForCard,
  cardHref,
  findConnections,
  conceptKey,
} from "@/lib/review-queue";
import { slugify, conceptHref, ideaHref } from "@/lib/slug";
import { todayISO, shortSpan, toISODate } from "@/lib/time";
import { ReviewCardForm } from "./insight-editor";
import { RecallProvider, AfterReveal } from "./recall";
import { readNotes, MY_TAKE } from "@/lib/notes";
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
  // Checking a prediction (arrived from the review page's list) isn't a
  // recall test: show the whole card straight away.
  const verifying = params.mode === "verify";
  const recallMode = !verifying && (params.mode === "recall" || isReReview);

  // Recompute the queue server-side to find this card's neighbours, so the
  // session flows through the whole queue instead of bouncing back to /review
  // after one card (the URL no longer carries the next/prev hops).
  const today = todayISO();
  // A daily session keeps its own running order across new and due cards.
  const navMode =
    params.mode === "session" || verifying
      ? params.mode
      : isReReview
        ? "rereview"
        : params.mode;
  const allItems = await getReviewQueue();
  const queue = queueForCard(allItems, currentPath, navMode, today);
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

  // Other ideas under this card's concepts — the cross-source links the
  // graph shows, turned into a question you answer after reveal.
  const connections = findConnections(allItems, {
    path: currentPath,
    source: allItems.find((i) => i.path === currentPath)?.source ?? "",
    concepts: item.relatedConcepts,
  });
  // Related chips link out only when the concept page exists.
  const conceptPages = new Set(
    (await listFiles("30 Concept")).map((p) =>
      conceptKey(p.replace(/\.md$/, ""))
    )
  );

  // A time-bound claim on this idea: once its check-by date arrives, judge it
  // against what actually happened. Calibration is a skill; this is the loop.
  const fm = item.frontmatter;
  const prediction = typeof fm.prediction === "string" ? fm.prediction.trim() : "";
  const verifyBy = toISODate(fm.verify_by);
  const sourceDate = toISODate(fm.source_date);
  const outcome =
    typeof fm.prediction_outcome === "string" ? fm.prediction_outcome : "";
  const checkDue = !!prediction && !!verifyBy && verifyBy <= today && !outcome;
  const OUTCOME_LABEL: Record<string, string> = {
    "came-true": "came true",
    partly: "partly true",
    wrong: "didn't happen",
  };
  const predictionBlock = prediction ? (
    <section className="prediction-check space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label">Prediction</h2>
        <span className="text-xs text-muted font-mono">
          {outcome
            ? `checked ${toISODate(fm.verified_date) ?? ""} · ${OUTCOME_LABEL[outcome] ?? outcome}`
            : verifyBy
              ? checkDue
                ? `time to check (since ${verifyBy})`
                : `check by ${verifyBy}`
              : ""}
        </span>
      </div>
      <p className="read">&ldquo;{prediction}&rdquo;</p>
      {sourceDate && (
        <p className="text-xs text-muted font-mono">said {sourceDate}</p>
      )}
      {checkDue && isLoggedIn && (
        <form action={reviewAction} className="space-y-2">
          <input type="hidden" name="path" value={currentPath} />
          <input type="hidden" name="returnTo" value="/review" />
          <input type="hidden" name="sha" value={item.sha} />
          <input type="hidden" name="rawContent" value={item.rawContent} />
          <textarea
            name="myTake"
            className="insight-textarea"
            rows={2}
            placeholder="What actually happened? One line of evidence, or a link. Saved to My Take."
          />
          <div className="action-row">
            <button
              type="submit"
              name="action"
              value="verify-came-true"
              className="btn btn-easy w-full"
            >
              Came true
            </button>
            <button
              type="submit"
              name="action"
              value="verify-partly"
              className="btn btn-medium w-full"
            >
              Partly
            </button>
            <button
              type="submit"
              name="action"
              value="verify-wrong"
              className="btn btn-hard w-full"
            >
              Didn&apos;t
            </button>
          </div>
        </form>
      )}
    </section>
  ) : null;

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
            className="touch-target text-muted hover:text-foreground transition-colors"
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

        {verifying && predictionBlock}

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
          earlierTakes={readNotes(item.content, MY_TAKE)}
        />

        {/* Source Context + Related — the quote usually states the insight
            outright, so both wait for reveal */}
        <AfterReveal>
          {!verifying && predictionBlock}

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

          {/* Connect — how does this sit next to what you already know? */}
          {connections.length > 0 && (
            <section className="space-y-3">
              <h2 className="label">Connect</h2>
              {connections.map((c) => {
                const slug = slugify(
                  c.item.path.split("/").pop()?.replace(/\.md$/, "") || ""
                );
                return (
                  <div key={c.item.path} className="connect-item">
                    <p className="text-xs text-muted font-mono">
                      also under {c.concept}
                      {c.sameSource ? " · same source" : ` · ${c.item.source}`}
                    </p>
                    <a
                      href={ideaHref(slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-heading hover:text-accent transition-colors"
                      style={{ fontSize: "1.1rem" }}
                    >
                      {c.item.title}
                    </a>
                    {c.item.insight && (
                      <p className="text-sm text-muted">{c.item.insight}</p>
                    )}
                  </div>
                );
              })}
              <p className="text-sm text-muted" style={{ fontStyle: "italic" }}>
                Same idea, a twist, or a clash? If you can say how they relate,
                add it to your take.
              </p>
            </section>
          )}

          {/* Related Concepts */}
          {item.relatedConcepts.length > 0 && (
            <section>
              <h2 className="label mb-3">Related</h2>
              <div style={{ marginRight: "-0.5rem", marginBottom: "-0.5rem" }}>
                {item.relatedConcepts.map((concept) => {
                  const chipClass =
                    "concept-chip inline-block text-xs px-2.5 py-1 border border-border text-muted rounded-sm font-mono";
                  const chipStyle = { marginRight: "0.5rem", marginBottom: "0.5rem" };
                  const name = concept.split("|")[0].split("/").pop()?.trim() || concept;
                  return conceptPages.has(conceptKey(concept)) ? (
                    <Link
                      key={concept}
                      href={conceptHref(slugify(name))}
                      className={`${chipClass} hover:text-foreground hover:border-foreground transition-colors`}
                      style={chipStyle}
                    >
                      {name}
                    </Link>
                  ) : (
                    <span key={concept} className={chipClass} style={chipStyle}>
                      {name}
                    </span>
                  );
                })}
              </div>
            </section>
          )}
        </AfterReveal>

        {nextPath && (
          <div className="text-center">
            <Link
              href={cardHref(nextPath, navMode, done)}
              className="touch-target text-sm text-muted hover:text-foreground transition-colors"
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
