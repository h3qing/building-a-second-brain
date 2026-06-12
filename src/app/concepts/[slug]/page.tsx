import { notFound } from "next/navigation";
import Link from "next/link";
import { findConceptBySlug } from "@/lib/content";
import { formatDate } from "@/lib/time";

export default async function ConceptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const concept = await findConceptBySlug(slug);

  if (!concept) notFound();

  const { title, bodyHtml, frontmatter } = concept;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          &larr; Knowledge Base
        </Link>
      </div>

      <div>
        <p className="label mb-2">Concept</p>
        <h1 className="text-3xl font-heading tracking-tight">{title}</h1>
      </div>

      <article
        className="prose prose-warm"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      <div className="border-t border-border pt-4 text-xs text-muted space-y-1">
        {frontmatter.source_count ? (
          <p>{String(frontmatter.source_count)} sources</p>
        ) : null}
        {formatDate(frontmatter.last_updated) ? (
          <p>Last updated: {formatDate(frontmatter.last_updated)}</p>
        ) : null}
      </div>
    </div>
  );
}
