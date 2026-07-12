import Link from "next/link";
import { buildGraphData } from "@/lib/graph";
import { parsePipelineFeed } from "@/lib/content";
import GraphSection from "./components/GraphSection";
import PipelineDiagram from "./components/PipelineDiagram";

export const revalidate = 900; // ISR: 15 minutes

export default async function Home() {
  const [graphData, feedEntries] = await Promise.all([
    buildGraphData(),
    parsePipelineFeed(),
  ]);

  // The vault always has content, so zero nodes means the GitHub fetch failed
  // (e.g. a transient rate limit). Throw rather than render an empty page —
  // ISR then keeps serving the last good page instead of caching the empty one.
  if (graphData.nodes.length === 0) {
    throw new Error("Knowledge graph data unavailable (GitHub fetch returned no nodes)");
  }

  const { stats } = graphData;
  const reviewedCount = stats.concepts + stats.ideas;

  return (
    <div className="space-y-8">
      {/* Navigation — top of page */}
      <nav className="flex items-center justify-between py-1">
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-foreground hover:text-accent transition-colors"
          >
            home
          </Link>
          <Link
            href="/write"
            className="text-muted hover:text-foreground transition-colors"
          >
            write
          </Link>
          <Link
            href="/review"
            className="text-muted hover:text-foreground transition-colors"
          >
            review queue
          </Link>
          <Link
            href="/tensions"
            className="text-muted hover:text-foreground transition-colors"
          >
            tensions
          </Link>
          <a
            href="https://heqinghuang.com"
            className="text-muted hover:text-foreground transition-colors"
          >
            blog
          </a>
          <a
            href="https://github.com/h3qing/second-brain"
            className="text-muted hover:text-foreground transition-colors"
          >
            github
          </a>
        </div>
      </nav>

      {/* Header */}
      <div>
        <h1 className="font-heading display-title tracking-tight">
          Heqing&apos;s Knowledge Base
        </h1>
        <p className="text-muted mt-2" style={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
          Books processed through an AI-assisted extraction pipeline.
          Human-reviewed. Open source.
        </p>
      </div>

      {/* Knowledge Graph — the centerpiece leads, full-bleed past the column */}
      <div className="rq-breakout">
        <div className="rq-inner">
          <p className="label mb-3">Knowledge Graph</p>
          <GraphSection data={{ nodes: graphData.nodes, links: graphData.links }} />
          {/* Status band — the vault's vitals in one strip under the map */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm border-b border-border py-4">
            <div>
              <span className="text-2xl font-heading text-accent">{reviewedCount}</span>
              <span className="text-muted ml-1.5">reviewed notes</span>
            </div>
            <div>
              <span className="text-2xl font-heading text-accent">{stats.links}</span>
              <span className="text-muted ml-1.5">connections</span>
            </div>
            <div>
              <span className="text-2xl font-heading text-accent">{stats.sources}</span>
              <span className="text-muted ml-1.5">sources</span>
            </div>
            {stats.essays > 0 && (
              <div>
                <span className="text-2xl font-heading text-accent">{stats.essays}</span>
                <span className="text-muted ml-1.5">essays</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* How It Works — after the map has made its case */}
      <PipelineDiagram
        ideas={stats.ideas}
        sources={stats.sources}
        concepts={stats.concepts}
      />

      {/* Pipeline Feed */}
      {feedEntries.length > 0 && (
        <div>
          <p className="label mb-3">Recent Activity</p>
          <div className="space-y-0">
            {feedEntries.slice(0, 8).map((entry, i) => (
              <div key={i} className="py-3 border-b border-border">
                <span className="text-xs text-muted font-mono">
                  {entry.date}
                </span>
                <div className="text-sm mt-1">
                  {entry.text}
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block ml-2 text-xs px-1.5 py-0.5 border border-border rounded text-muted font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
