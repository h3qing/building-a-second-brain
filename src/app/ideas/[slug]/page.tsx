import { notFound } from "next/navigation";
import Link from "next/link";
import { findIdeaBySlug } from "@/lib/content";
import { toISODate } from "@/lib/time";
import { ContentViewTracker } from "@/app/components/content-view-tracker";

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const idea = await findIdeaBySlug(slug);

  if (!idea) notFound();

  const { title, bodyHtml, frontmatter } = idea;

  const source =
    typeof frontmatter.source === "string"
      ? frontmatter.source.replace(/\[\[|\]\]/g, "").split("/").pop() || ""
      : "";

  return (
    <div className="space-y-6">
      <ContentViewTracker
        content_id={`ideas/${slug}`}
        content_type="note"
        content_title={title}
        content_published_at={toISODate(frontmatter.reviewed_date)}
      />
      <div>
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          &larr; Knowledge Base
        </Link>
      </div>

      <div>
        <p className="label mb-2">Idea{source ? ` from ${source}` : ""}</p>
        <h1 className="text-3xl font-heading tracking-tight">{title}</h1>
      </div>

      <article
        className="prose prose-warm"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {Array.isArray(frontmatter.tags) && frontmatter.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {(frontmatter.tags as string[]).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-1 border border-border text-muted rounded-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
