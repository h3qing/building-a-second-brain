const Arrow = () => (
  <div className="flex justify-center py-1">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      className="text-border">
      <path d="M8 2v10M4 9l4 4 4-4"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

const Tag = ({ children }: { children: string }) => (
  <span className="font-mono text-[0.65rem] tracking-[0.05em] uppercase text-muted px-1.5 py-0.5 border border-border rounded">
    {children}
  </span>
);

const StepLabel = ({ children, accent = false }: { children: string; accent?: boolean }) => (
  <div
    className={`text-center text-[0.7rem] font-mono tracking-[0.05em] -mt-0.5 mb-0.5 ${
      accent ? "text-accent" : "text-muted"
    }`}
  >
    {children}
  </div>
);

const boxTitle = "font-heading text-base font-medium mb-1.5 tracking-tight";
const boxDesc = "text-[0.8rem] text-muted italic leading-normal";
// The accent boxes keep a faint accent wash — no token class exists for the
// color-mix, so it stays inline.
const accentWash = {
  borderColor: "var(--ink-accent)",
  background: "color-mix(in srgb, var(--ink-accent) 4%, var(--background))",
};

interface PipelineDiagramProps {
  // Live vault counts (reviewed ideas, distinct sources, concepts) — the
  // homepage feeds these from the graph build instead of hardcoded numbers.
  ideas: number;
  sources: number;
  concepts: number;
}

export default function PipelineDiagram({ ideas, sources, concepts }: PipelineDiagramProps) {
  return (
    <div className="my-8 p-6 border border-border rounded-lg bg-background">
      <div className="font-heading text-[1.1rem] text-muted mb-5 tracking-tight">
        How Knowledge Moves
      </div>

      {/* Layer 1: Sources */}
      <div className="border border-border rounded-lg px-5 py-4 bg-background">
        <div className="flex justify-between items-baseline">
          <div className={boxTitle} style={{ color: "var(--ink-ink)" }}>10 Notes/</div>
          <Tag>immutable</Tag>
        </div>
        <div className={boxDesc}>
          Raw sources. Kindle highlights, articles, podcasts, videos. Never modified after capture.
          This is the ground truth.
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <Tag>kindle notes</Tag>
          <Tag>articles</Tag>
          <Tag>podcasts</Tag>
          <Tag>videos</Tag>
          <Tag>personal</Tag>
        </div>
      </div>

      <Arrow />
      <StepLabel>CLAUDE CODE EXTRACTS</StepLabel>
      <Arrow />

      {/* Layer 2: Ideas */}
      <div className="border border-border rounded-lg px-5 py-4 bg-background">
        <div className="flex justify-between items-baseline">
          <div className={boxTitle} style={{ color: "var(--ink-ink)" }}>20 Ideas/</div>
          <Tag>ai-generated</Tag>
        </div>
        <div className={boxDesc}>
          Atomic ideas extracted per source. Each idea is one insight, one file. Links back to the
          original highlight. This is where AI does the heavy lifting.
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <Tag>{`${ideas} reviewed ideas`}</Tag>
          <Tag>{`${sources} sources`}</Tag>
        </div>
      </div>

      <Arrow />
      <StepLabel>SYNTHESIZE ACROSS SOURCES</StepLabel>
      <Arrow />

      {/* Layer 3: Concepts */}
      <div className="border rounded-lg px-5 py-4" style={accentWash}>
        <div className="flex justify-between items-baseline">
          <div className={`${boxTitle} text-accent`}>30 Concept/</div>
          <Tag>wiki layer</Tag>
        </div>
        <div className={boxDesc}>
          Cross-source concepts. A concept like &ldquo;negotiation&rdquo; pulls insights from books,
          articles, conversations. Wikilinked. This is the knowledge graph.
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <Tag>{`${concepts} concepts`}</Tag>
          <Tag>cross-referenced</Tag>
        </div>
      </div>

      <Arrow />
      <StepLabel accent>HUMAN REVIEWS ON KINDLE</StepLabel>
      <Arrow />

      {/* Layer 4: This App */}
      <div className="border rounded-lg px-5 py-4" style={accentWash}>
        <div className="flex justify-between items-baseline">
          <div className={`${boxTitle} text-accent`}>second-brain.heqinghuang.com</div>
        </div>
        <div className={boxDesc}>
          AI extracts. Human reviews. Only approved content goes public.
          The graph grows as you read more books and review more ideas.
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <div className="border border-border rounded-lg px-3 py-2.5 bg-background text-center">
            <div className="text-[0.65rem] font-mono text-muted uppercase tracking-[0.05em]">Public</div>
            <div className="text-[0.8rem] text-foreground mt-1">Graph + Feed</div>
          </div>
          <div className="border rounded-lg px-3 py-2.5 bg-background text-center" style={{ borderColor: "var(--ink-accent)" }}>
            <div className="text-[0.65rem] font-mono text-accent uppercase tracking-[0.05em]">Private</div>
            <div className="text-[0.8rem] text-foreground mt-1">Review Queue</div>
          </div>
        </div>
      </div>

      {/* Meta orchestration note */}
      <div className="mt-5 px-4 py-3 border border-dashed border-border rounded-md flex gap-3 items-baseline">
        <span className={`${boxTitle} text-[0.85rem] whitespace-nowrap`} style={{ color: "var(--ink-ink)", marginBottom: 0 }}>
          00 Meta/
        </span>
        <span className={`${boxDesc} not-italic`}>
          Orchestrates everything. Index of all pages, operation log, schema definition,
          review queue. The system&apos;s memory of itself.
        </span>
      </div>

      {/* Caption */}
      <div className="mt-4 text-[0.75rem] text-muted text-center italic">
        The graph grows as you review.
        Fork this project on <a href="https://github.com/h3qing/second-brain" className="text-accent">GitHub</a>.
      </div>
    </div>
  );
}
