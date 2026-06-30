const Arrow = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: "0.25rem 0" }}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ color: "var(--ink-border)" }}>
      <path d="M8 2v10M4 9l4 4 4-4"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

const Tag = ({ children }: { children: string }) => (
  <span style={{
    fontFamily: "var(--font-mono)",
    fontSize: "0.65rem",
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    color: "var(--ink-muted)",
    padding: "0.15rem 0.4rem",
    border: "1px solid var(--ink-border)",
    borderRadius: "3px",
  }}>
    {children}
  </span>
);

export default function PipelineDiagram() {
  const box = {
    border: "1px solid var(--ink-border)",
    borderRadius: "8px",
    padding: "1rem 1.25rem",
    background: "var(--ink-paper)",
  };

  const accentBox = {
    ...box,
    borderColor: "var(--ink-accent)",
    background: "color-mix(in srgb, var(--ink-accent) 4%, var(--ink-paper))",
  };

  const title = {
    fontFamily: "var(--font-heading), Georgia, serif",
    fontSize: "1rem",
    fontWeight: 500 as const,
    color: "var(--ink-ink)",
    marginBottom: "0.35rem",
    letterSpacing: "-0.01em",
  };

  const desc = {
    fontSize: "0.8rem",
    fontWeight: 400 as const,
    color: "var(--ink-muted)",
    fontStyle: "italic" as const,
    lineHeight: 1.5,
  };

  return (
    <div style={{
      margin: "2rem 0",
      padding: "1.5rem",
      border: "1px solid var(--ink-border)",
      borderRadius: "8px",
      background: "var(--ink-paper)",
    }}>
      <div style={{
        fontFamily: "var(--font-heading), Georgia, serif",
        fontSize: "1.1rem",
        fontWeight: 400,
        color: "var(--ink-muted)",
        marginBottom: "1.25rem",
        letterSpacing: "-0.01em",
      }}>
        How Knowledge Moves
      </div>

      {/* Layer 1: Sources */}
      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={title}>10 Notes/</div>
          <Tag>immutable</Tag>
        </div>
        <div style={desc}>
          Raw sources. Kindle highlights, articles, podcasts, videos. Never modified after capture.
          This is the ground truth.
        </div>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "0.4rem",
          marginTop: "0.6rem",
        }}>
          <Tag>kindle notes</Tag>
          <Tag>articles</Tag>
          <Tag>podcasts</Tag>
          <Tag>videos</Tag>
          <Tag>personal</Tag>
        </div>
      </div>

      <Arrow />
      <div style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--ink-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", margin: "-0.15rem 0 0.1rem" }}>
        CLAUDE CODE EXTRACTS
      </div>
      <Arrow />

      {/* Layer 2: Ideas */}
      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={title}>20 Ideas/</div>
          <Tag>ai-generated</Tag>
        </div>
        <div style={desc}>
          Atomic ideas extracted per source. Each idea is one insight, one file. Links back to the
          original highlight. This is where AI does the heavy lifting.
        </div>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "0.4rem",
          marginTop: "0.6rem",
        }}>
          <Tag>89 ideas</Tag>
          <Tag>12 books</Tag>
          <Tag>unreviewed</Tag>
        </div>
      </div>

      <Arrow />
      <div style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--ink-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", margin: "-0.15rem 0 0.1rem" }}>
        SYNTHESIZE ACROSS SOURCES
      </div>
      <Arrow />

      {/* Layer 3: Concepts */}
      <div style={accentBox}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ ...title, color: "var(--ink-accent)" }}>30 Concept/</div>
          <Tag>wiki layer</Tag>
        </div>
        <div style={desc}>
          Cross-source concepts. A concept like &ldquo;negotiation&rdquo; pulls insights from books,
          articles, conversations. Wikilinked. This is the knowledge graph.
        </div>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "0.4rem",
          marginTop: "0.6rem",
        }}>
          <Tag>42 concepts</Tag>
          <Tag>cross-referenced</Tag>
        </div>
      </div>

      <Arrow />
      <div style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--ink-accent)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", margin: "-0.15rem 0 0.1rem" }}>
        HUMAN REVIEWS ON KINDLE
      </div>
      <Arrow />

      {/* Layer 4: This App */}
      <div style={accentBox}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ ...title, color: "var(--ink-accent)" }}>second-brain.heqinghuang.com</div>
        </div>
        <div style={desc}>
          AI extracts. Human reviews. Only approved content goes public.
          The graph grows as you read more books and review more ideas.
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem",
          marginTop: "0.6rem",
        }}>
          <div style={{
            ...box,
            padding: "0.6rem 0.75rem",
            textAlign: "center" as const,
          }}>
            <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Public</div>
            <div style={{ fontSize: "0.8rem", color: "var(--ink-text)", marginTop: "0.2rem" }}>Graph + Feed</div>
          </div>
          <div style={{
            ...box,
            padding: "0.6rem 0.75rem",
            borderColor: "var(--ink-accent)",
            textAlign: "center" as const,
          }}>
            <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--ink-accent)", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Private</div>
            <div style={{ fontSize: "0.8rem", color: "var(--ink-text)", marginTop: "0.2rem" }}>Review Queue</div>
          </div>
        </div>
      </div>

      {/* Meta orchestration note */}
      <div style={{
        marginTop: "1.25rem",
        padding: "0.75rem 1rem",
        border: "1px dashed var(--ink-border)",
        borderRadius: "6px",
        display: "flex",
        gap: "0.75rem",
        alignItems: "baseline",
      }}>
        <span style={{ ...title, fontSize: "0.85rem", marginBottom: 0, whiteSpace: "nowrap" as const }}>00 Meta/</span>
        <span style={{ ...desc, fontStyle: "normal" }}>
          Orchestrates everything. Index of all pages, operation log, schema definition,
          review queue. The system&apos;s memory of itself.
        </span>
      </div>

      {/* Caption */}
      <div style={{
        marginTop: "1rem",
        fontSize: "0.75rem",
        color: "var(--ink-muted)",
        textAlign: "center" as const,
        fontStyle: "italic",
      }}>
        The graph grows as you review.
        Fork this project on <a href="https://github.com/h3qing/second-brain" style={{ color: "var(--ink-accent)" }}>GitHub</a>.
      </div>
    </div>
  );
}
