import Link from "next/link";
import { notFound } from "next/navigation";
import { getWritingBrief, renderBriefMarkdown } from "@/lib/write";
import { CopyBriefButton } from "./copy-button";

export const dynamic = "force-dynamic";

export default async function BriefPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brief = await getWritingBrief(slug);
  if (!brief) notFound();

  const markdown = renderBriefMarkdown(brief);

  return (
    <article className="space-y-8">
      <div className="flex items-center justify-between text-sm">
        <Link
          href="/write"
          className="text-muted hover:text-foreground transition-colors"
        >
          &larr; Write
        </Link>
        <CopyBriefButton markdown={markdown} />
      </div>

      <header className="space-y-2">
        <div className="label">Writing brief</div>
        <h1
          className="font-heading tracking-tight leading-tight"
          style={{ fontSize: "2rem", fontWeight: 400 }}
        >
          {brief.concept}
        </h1>
        {brief.definition && <p className="read">{brief.definition}</p>}
      </header>

      {brief.tensions && (
        <section className="space-y-2">
          <h2 className="label">Tension to resolve</h2>
          <p className="read">{brief.tensions}</p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="label">Prompt</h2>
        <p
          className="read"
          style={{
            borderLeft: "2px solid var(--ink-accent)",
            paddingLeft: "1.25rem",
          }}
        >
          {brief.prompt}
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="label">Material ({brief.ideaCount} reviewed ideas)</h2>
        {brief.ideas.map((idea) => (
          <div key={idea.slug} className="border-t border-border pt-4 space-y-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <Link
                href={idea.url}
                className="font-heading hover:text-accent transition-colors"
                style={{ fontSize: "1.15rem" }}
              >
                {idea.title}
              </Link>
              {idea.source && (
                <span className="text-xs text-muted font-mono">
                  {idea.source}
                </span>
              )}
            </div>
            {idea.insight && <p className="read">{idea.insight}</p>}
            {idea.quote && (
              <blockquote
                className="read text-muted"
                style={{
                  borderLeft: "2px solid var(--border)",
                  paddingLeft: "1rem",
                  fontStyle: "italic",
                  marginTop: "0.5rem",
                }}
              >
                {idea.quote}
              </blockquote>
            )}
          </div>
        ))}
      </section>
    </article>
  );
}
