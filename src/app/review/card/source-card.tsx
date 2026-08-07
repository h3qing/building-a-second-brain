import { getSourceInfo } from "@/lib/source";

const TYPE_META: Record<string, { icon: string; label: string }> = {
  book: { icon: "📖", label: "Book" },
  podcast: { icon: "🎙", label: "Podcast" },
  article: { icon: "📰", label: "Article" },
  video: { icon: "🎬", label: "Video" },
  conversation: { icon: "💬", label: "Conversation" },
  course: { icon: "🎓", label: "Course" },
  personal: { icon: "✍️", label: "Personal note" },
};

// Prominent "where this idea comes from" block. Reviewing an idea without its
// source in view strips the context that made it worth capturing — so the
// source gets a card, not a breadcrumb. Async (resolves the source note);
// render inside Suspense.
export async function SourceCard({
  frontmatter,
  path,
}: {
  frontmatter: Record<string, unknown>;
  path: string;
}) {
  const info = await getSourceInfo(frontmatter, path);
  if (!info || !info.title) return null;

  const meta = TYPE_META[info.type] || { icon: "📚", label: "Source" };
  const year = info.sourceDate ? String(info.sourceDate).slice(0, 4) : "";

  const body = (
    <>
      {info.coverUrl ? (
        // Covers live on arbitrary external hosts (Amazon CDN etc.), so a
        // plain <img> beats configuring next/image remotePatterns per host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={info.coverUrl}
          alt={`Cover of ${info.title}`}
          referrerPolicy="no-referrer"
          className="rounded-sm"
          style={{
            width: "3rem",
            height: "4.5rem",
            objectFit: "cover",
            flexShrink: 0,
            boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
          }}
        />
      ) : (
        <div
          aria-hidden
          className="rounded-sm border border-border flex items-center justify-center"
          style={{
            width: "3rem",
            height: "4.5rem",
            flexShrink: 0,
            fontSize: "1.4rem",
            background: "var(--background)",
          }}
        >
          {meta.icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="label">
          {meta.label}
          {year && ` · ${year}`}
        </div>
        <div
          className="font-heading"
          style={{
            fontSize: "1.05rem",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {info.title}
        </div>
        {info.author && (
          <p className="text-sm text-muted truncate" style={{ marginTop: "0.1rem" }}>
            {info.author}
          </p>
        )}
      </div>
      {info.url && (
        <span
          aria-hidden
          className="text-muted"
          style={{ marginLeft: "auto", flexShrink: 0, fontSize: "0.9rem" }}
        >
          ↗
        </span>
      )}
    </>
  );

  const cardClass = "flex items-center gap-4 border border-border rounded-sm p-3";
  const cardStyle = { background: "var(--highlight)" };

  return info.url ? (
    <a
      href={info.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cardClass} no-underline hover:border-foreground transition-colors`}
      style={cardStyle}
      title={`Open source: ${info.title}`}
    >
      {body}
    </a>
  ) : (
    <div className={cardClass} style={cardStyle}>
      {body}
    </div>
  );
}
