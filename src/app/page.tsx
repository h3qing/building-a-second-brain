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

  const reviewedCount = graphData.nodes.length;
  const totalLinks = graphData.stats.totalLinks;

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
        <h1
          className="font-heading tracking-tight"
          style={{ fontSize: "2.2rem", fontWeight: 300, letterSpacing: "-0.01em" }}
        >
          Heqing&apos;s Knowledge Base
        </h1>
        <p className="text-muted mt-2" style={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
          150+ books processed through an AI-assisted extraction pipeline.
          Human-reviewed. Open source.
        </p>
      </div>

      {/* How It Works — prominent, right after intro */}
      <PipelineDiagram />

      {/* Stats — only show when there's something to show */}
      {(reviewedCount > 0 || totalLinks > 0) && (
        <div className="flex gap-8 text-sm border-t border-b border-border py-4">
          <div>
            <span className="text-2xl font-heading text-accent">
              {reviewedCount}
            </span>
            <span className="text-muted ml-1.5">reviewed</span>
          </div>
          <div>
            <span className="text-2xl font-heading text-accent">
              {totalLinks}
            </span>
            <span className="text-muted ml-1.5">connections</span>
          </div>
          <div>
            <span className="text-2xl font-heading text-accent">
              150+
            </span>
            <span className="text-muted ml-1.5">books</span>
          </div>
        </div>
      )}

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

      {/* Knowledge Graph — bottom, grows over time */}
      {reviewedCount > 0 && (
        <div>
          <p className="label mb-3">Knowledge Graph</p>
          <GraphSection data={graphData} />
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border pt-4 pb-8 text-xs text-muted">
        <p>
          Built with{" "}
          <a href="https://claude.ai" className="text-accent hover:underline">Claude Code</a>
          {" "}+{" "}
          <a href="https://obsidian.md" className="text-accent hover:underline">Obsidian</a>.
          Inspired by{" "}
          <a href="https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f" className="text-accent hover:underline">
            Karpathy&apos;s LLM Wiki
          </a>.
        </p>
      </footer>
    </div>
  );
}
