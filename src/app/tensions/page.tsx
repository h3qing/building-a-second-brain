import Link from "next/link";
import { getTensions } from "@/lib/tensions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tensions — Second Brain",
  description: "Where your sources disagree.",
};

export default async function TensionsPage() {
  const tensions = await getTensions();

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-heading tracking-tight">
            Tensions
          </h1>
          <Link
            href="/"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            &larr; home
          </Link>
        </div>
        <p className="text-muted" style={{ lineHeight: 1.7 }}>
          {tensions.length} places where your sources disagree. Taking a side is
          how reading turns into writing. Pick one and argue it.
        </p>
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
                  className="label whitespace-nowrap hover:text-foreground transition-colors"
                >
                  take a side &rarr;
                </Link>
              </div>
              <p className="read">{t.text}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
