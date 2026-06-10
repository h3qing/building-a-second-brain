import { redirect } from "next/navigation";
import Link from "next/link";
import { verifySession } from "@/lib/auth";
import { getFileContent } from "@/lib/github";
import { parseReviewItem } from "@/lib/parser";
import { ReviewCardForm } from "./insight-editor";

export default async function CardReview({
  searchParams,
}: {
  searchParams: Promise<{
    path?: string;
    next?: string;
    prev?: string;
    pos?: string;
    mode?: string;
  }>;
}) {
  const isLoggedIn = await verifySession();

  const params = await searchParams;
  const currentPath = params.path;

  if (!currentPath) redirect("/review");

  const file = await getFileContent(currentPath);
  if (!file) redirect("/review");

  const item = await parseReviewItem(currentPath, file.sha, file.content);

  const nextPath = params.next || null;
  const prevPath = params.prev || null;
  const position = params.pos || "";

  const isReReview =
    params.mode === "rereview" ||
    (typeof item.frontmatter.review_count === "number" &&
      item.frontmatter.review_count >= 1 &&
      item.frontmatter.review_status === "reviewed");

  // Active recall: re-reviews test recall by default; ?mode=recall forces it.
  const recallMode = params.mode === "recall" || isReReview;

  const nextForAction = nextPath
    ? `/review/card?path=${encodeURIComponent(nextPath)}${isReReview ? "&mode=rereview" : ""}`
    : "/review";

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
        <div className="label">{folder}</div>
        <h1
          className="font-heading tracking-tight leading-tight"
          style={{ fontSize: "2rem", fontWeight: 400 }}
        >
          {item.title}
        </h1>
      </header>

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
              <p>{ctx.quote}</p>
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
            href={`/review/card?path=${encodeURIComponent(nextPath)}`}
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
          <Link
            href={`/review/card?path=${encodeURIComponent(prevPath)}`}
            className="btn btn-nav"
          >
            &larr; Prev
          </Link>
        ) : (
          <span />
        )}
        {nextPath ? (
          <Link
            href={`/review/card?path=${encodeURIComponent(nextPath)}`}
            className="btn btn-nav"
          >
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
