import Link from "next/link";
import { getWritableConcepts } from "@/lib/write";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Write — Second Brain",
  description: "Concepts you've reviewed enough to write about.",
};

export default async function WritePage() {
  const concepts = await getWritableConcepts();

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-heading tracking-tight">
            Write
          </h1>
          <Link
            href="/"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            &larr; home
          </Link>
        </div>
        <p className="text-muted" style={{ lineHeight: 1.7 }}>
          Concepts where you&apos;ve reviewed enough to have something to say.
          Open one for a writing brief: the definition, the tension, and every
          idea, assembled to draft from.
        </p>
      </header>

      {concepts.length === 0 ? (
        <p className="text-muted">
          Nothing ready yet. Once 3+ reviewed ideas link to the same concept,
          it shows up here.
        </p>
      ) : (
        <div className="space-y-5">
          {concepts.map((c) => (
            <Link
              key={c.slug}
              href={c.url}
              className="block border-t border-border pt-5 group"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span
                  className="font-heading group-hover:text-accent transition-colors"
                  style={{ fontSize: "1.35rem" }}
                >
                  {c.concept}
                </span>
                <span className="label whitespace-nowrap">
                  {c.ideaCount} ideas &rarr;
                </span>
              </div>
              {c.definition && (
                <p className="text-muted text-sm mt-1" style={{ lineHeight: 1.6 }}>
                  {c.definition}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
