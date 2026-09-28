import Link from "next/link";
import { getTensions } from "@/lib/tensions";
import { OutboundLink } from "@/app/components/outbound-link";
import { verifySession } from "@/lib/auth";
import { takeSideAction } from "./action";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tensions — Second Brain",
  description: "Where your sources disagree.",
};

export default async function TensionsPage() {
  const isOwner = await verifySession();
  const tensions = await getTensions(isOwner);
  const sided = tensions.filter((t) => t.mySide).length;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-heading tracking-tight">
            Tensions
          </h1>
          <Link
            href="/"
            className="touch-target text-sm text-muted hover:text-foreground transition-colors"
          >
            &larr; home
          </Link>
        </div>
        <p className="text-muted" style={{ lineHeight: 1.7 }}>
          {tensions.length} places where your sources disagree. Taking a side is
          how reading turns into writing. Pick one and argue it.
        </p>
        {isOwner && tensions.length > 0 && (
          <p className="text-sm text-muted">
            You&apos;ve taken a side on {sided} of {tensions.length}.
          </p>
        )}
      </header>

      {tensions.length === 0 ? (
        <p className="text-muted">
          No tensions yet. They surface as concepts accumulate conflicting
          sources.
        </p>
      ) : (
        <div className="space-y-7">
          {tensions.map((t) => (
            <article
              key={t.slug}
              id={t.slug}
              className="border-t border-border pt-5 space-y-2"
            >
              <div className="flex items-baseline justify-between gap-4">
                <Link
                  href={t.url}
                  className="font-heading hover:text-accent transition-colors"
                  style={{ fontSize: "1.35rem" }}
                >
                  {t.concept}
                </Link>
                <Link
                  href={t.url}
                  className="touch-target label whitespace-nowrap hover:text-foreground transition-colors"
                >
                  {/* Signed in, "take a side" is the box below; this just opens the concept. */}
                  {isOwner ? "open concept" : "take a side"} &rarr;
                </Link>
              </div>
              <p className="read">{t.text}</p>
              {t.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {t.sources.map((s) => {
                    const icon = s.type === "podcast" ? "🎙" : "📖";
                    const className =
                      "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 border border-border rounded-sm text-muted font-mono";
                    return s.url ? (
                      <OutboundLink
                        key={s.name}
                        href={s.url}
                        className={`${className} hover:text-foreground hover:border-foreground transition-colors`}
                      >
                        <span>{icon}</span>
                        <span>{s.name}</span>
                      </OutboundLink>
                    ) : (
                      <span key={s.name} className={className}>
                        <span>{icon}</span>
                        <span>{s.name}</span>
                      </span>
                    );
                  })}
                </div>
              )}
              {isOwner && t.mySide && (
                <div className="my-takes" style={{ marginTop: "0.75rem" }}>
                  <p className="label">
                    Your side{t.mySide.date && ` · ${t.mySide.date}`}
                  </p>
                  <p className="read">{t.mySide.text}</p>
                </div>
              )}
              {isOwner && (
                // <details> opens without JS — works on the Kindle too.
                <details className="take-side">
                  <summary className="label">
                    {t.mySide ? "Update your side" : "Take a side"}
                  </summary>
                  <form action={takeSideAction} className="space-y-2">
                    <input type="hidden" name="path" value={t.path} />
                    <input
                      type="hidden"
                      name="returnTo"
                      value={`/tensions#${encodeURIComponent(t.slug)}`}
                    />
                    <textarea
                      name="side"
                      className="insight-textarea"
                      rows={3}
                      required
                      placeholder="Which source is right, or what they both miss. One or two sentences in your own words."
                    />
                    <button type="submit" className="btn btn-nav">
                      Save my side
                    </button>
                  </form>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
