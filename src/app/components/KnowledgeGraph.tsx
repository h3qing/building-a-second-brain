"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      Loading graph...
    </div>
  ),
});

interface GraphNode {
  id: string;
  title: string;
  tags: string[];
  excerpt: string;
  folder: string;
  linkCount: number;
  isOrphan: boolean;
  color: string;
  slug: string;
  type: "concept" | "idea" | "writing";
  url?: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    totalNotes: number;
    totalLinks: number;
    orphanCount: number;
    tagCounts: Record<string, number>;
  };
}

// Warm palette matching Ink & Parchment theme
const TAG_COLORS: Record<string, string> = {
  negotiation: "#c47a5a",
  hiring: "#7b9eb8",
  decision: "#9b7eb8",
  organization: "#7ba87e",
  competence: "#c4a05a",
  leadership: "#b87a7a",
  productivity: "#8ba87b",
  default: "#a09080",
};

const CONCEPT_COLOR = "#8b6914"; // gold — synthesized concepts
const IDEA_COLOR = "#a09080"; // tan — atomic ideas
const WRITING_COLOR = "#b5603f"; // clay — published essays (drawn as diamonds)

function getNodeColor(node: GraphNode): string {
  // Essays get a fixed color so they read as one category regardless of tags.
  if (node.type === "writing") return WRITING_COLOR;
  if (node.color) return node.color;
  for (const tag of node.tags) {
    const normalized = tag.toLowerCase().replace(/\s+/g, "");
    if (TAG_COLORS[normalized]) return TAG_COLORS[normalized];
  }
  return node.type === "concept" ? CONCEPT_COLOR : IDEA_COLOR;
}

interface KnowledgeGraphProps {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
}

export default function KnowledgeGraph({
  data,
  onNodeClick,
}: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      const { width } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height: Math.min(500, width * 0.65) });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const filteredData = useMemo(() => {
    let nodes = data.nodes.filter((n) => !n.isOrphan);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchedIds = new Set(
        nodes
          .filter(
            (n) =>
              n.title.toLowerCase().includes(query) ||
              n.tags.some((t) => t.toLowerCase().includes(query))
          )
          .map((n) => n.id)
      );

      for (const link of data.links) {
        const sourceId =
          typeof link.source === "string" ? link.source : link.source.id;
        const targetId =
          typeof link.target === "string" ? link.target : link.target.id;
        if (matchedIds.has(sourceId)) matchedIds.add(targetId);
        if (matchedIds.has(targetId)) matchedIds.add(sourceId);
      }

      nodes = nodes.filter((n) => matchedIds.has(n.id));
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = data.links.filter((link) => {
      const sourceId =
        typeof link.source === "string" ? link.source : link.source.id;
      const targetId =
        typeof link.target === "string" ? link.target : link.target.id;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    return { nodes, links };
  }, [data, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fgRef.current) return;
      fgRef.current.d3Force("charge")?.strength(-82).distanceMax(340);
      fgRef.current.d3Force("link")?.distance(44).strength(0.55);
      fgRef.current.d3Force("center")?.strength(0.6);
      fgRef.current.d3ReheatSimulation();

      if (filteredData.nodes.length > 0) {
        setTimeout(() => {
          fgRef.current?.zoomToFit(550, 80);
        }, 650);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [filteredData.nodes.length]);

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode((node as GraphNode | null) || null);
    document.body.style.cursor = node ? "pointer" : "default";
  }, []);

  const handleNodeClickInternal = useCallback(
    (node: any) => {
      if (node.x !== undefined && node.y !== undefined && fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 350);
      }
      onNodeClick?.(node as GraphNode);
    },
    [onNodeClick]
  );

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GraphNode;
      const color = getNodeColor(graphNode);
      const baseSize = 3 + Math.sqrt(graphNode.linkCount + 1) * 1.8;
      const nodeSize = Math.max(4, baseSize);
      const isHovered = hoveredNode?.id === graphNode.id;
      const isSearchHit =
        !!searchQuery &&
        graphNode.title.toLowerCase().includes(searchQuery.toLowerCase());

      const cx = node.x || 0;
      const cy = node.y || 0;
      const r = isHovered ? nodeSize + 1.3 : nodeSize;
      const isWriting = graphNode.type === "writing";

      ctx.beginPath();
      if (isWriting) {
        // Diamonds mark published essays — distinct from concept/idea circles.
        const d = r * 1.3;
        ctx.moveTo(cx, cy - d);
        ctx.lineTo(cx + d, cy);
        ctx.lineTo(cx, cy + d);
        ctx.lineTo(cx - d, cy);
        ctx.closePath();
      } else {
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      }

      if (isHovered) {
        ctx.fillStyle = "#faf8f5";
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
      } else if (isSearchHit) {
        ctx.fillStyle = "#c49a2e";
        ctx.shadowColor = "#c49a2e";
        ctx.shadowBlur = 12;
      } else {
        ctx.fillStyle = color;
        ctx.shadowBlur = 0;
      }
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.lineWidth = isHovered ? 1.8 / globalScale : 1 / globalScale;
      ctx.strokeStyle = isHovered ? color : "rgba(180, 168, 148, 0.3)";
      ctx.stroke();

      // Keep the default view clean: labels on hover/search always, essays on a
      // gentle zoom-in (they're the highlight), other nodes only when zoomed further.
      const shouldRenderLabel =
        isHovered ||
        isSearchHit ||
        globalScale > 2.2 ||
        (isWriting && globalScale > 1.35);
      if (!shouldRenderLabel) return;

      const rawLabel =
        graphNode.title.length > 34
          ? `${graphNode.title.slice(0, 34)}...`
          : graphNode.title;
      const fontSize = Math.max(11 / globalScale, 5.5);
      const y = (node.y || 0) + nodeSize + 4 / globalScale;

      ctx.font = `600 ${fontSize}px "Crimson Pro", Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const textWidth = ctx.measureText(rawLabel).width;
      const hPad = 5 / globalScale;
      const vPad = 3 / globalScale;
      ctx.fillStyle = "rgba(26, 24, 18, 0.85)";
      ctx.fillRect(
        (node.x || 0) - textWidth / 2 - hPad,
        y - vPad,
        textWidth + hPad * 2,
        fontSize + vPad * 2
      );

      ctx.fillStyle = "rgba(250, 248, 245, 0.95)";
      ctx.fillText(rawLabel, node.x || 0, y);
    },
    [hoveredNode, searchQuery]
  );

  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const source = link.source as GraphNode;
      const target = link.target as GraphNode;

      if (
        source.x === undefined ||
        source.y === undefined ||
        target.x === undefined ||
        target.y === undefined
      ) {
        return;
      }

      const connectedToHovered =
        hoveredNode &&
        (source.id === hoveredNode.id || target.id === hoveredNode.id);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = connectedToHovered
        ? "rgba(139, 105, 20, 0.6)"
        : "rgba(180, 168, 148, 0.2)";
      ctx.lineWidth = connectedToHovered
        ? 1.6 / globalScale
        : 0.8 / globalScale;
      ctx.stroke();
    },
    [hoveredNode]
  );

  if (data.nodes.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-muted">
        <p className="text-lg mb-2">No reviewed content yet.</p>
        <p className="text-sm">
          The knowledge graph will appear as ideas are reviewed.
        </p>
      </div>
    );
  }

  return (
    <div className="relative border border-border rounded-lg overflow-hidden bg-card">
      {/* Search */}
      <div className="absolute top-3 left-3 z-10">
        <input
          type="text"
          placeholder="Search concepts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 text-sm bg-background/90 border border-border rounded-md backdrop-blur-sm focus:outline-none focus:border-accent"
        />
      </div>

      {/* Stats chip */}
      <div className="absolute top-3 right-3 z-10 text-xs text-muted bg-background/90 border border-border rounded-full px-3 py-1 backdrop-blur-sm">
        {filteredData.nodes.length} nodes · {filteredData.links.length} links
      </div>

      {/* Legend */}
      <div className="absolute top-12 right-3 z-10 flex items-center gap-3 text-xs text-muted bg-background/90 border border-border rounded-full px-3 py-1 backdrop-blur-sm">
        <span className="flex items-center gap-1.5">
          <span
            style={{ width: 8, height: 8, borderRadius: "50%", background: CONCEPT_COLOR }}
          />
          concept
        </span>
        <span className="flex items-center gap-1.5">
          <span
            style={{ width: 8, height: 8, borderRadius: "50%", background: IDEA_COLOR }}
          />
          idea
        </span>
        <span className="flex items-center gap-1.5">
          <span
            style={{ width: 7, height: 7, background: WRITING_COLOR, transform: "rotate(45deg)" }}
          />
          essay
        </span>
      </div>

      {/* Graph canvas */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: dimensions.height,
          cursor: hoveredNode ? "pointer" : "grab",
        }}
      >
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={filteredData}
          nodeId="id"
          nodeLabel=""
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            const size = Math.max(
              8,
              4 + Math.sqrt(node.linkCount + 1) * 2.1
            );
            ctx.beginPath();
            ctx.arc(node.x || 0, node.y || 0, size + 18, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkCanvasObject={linkCanvasObject}
          linkDirectionalParticles={0}
          onNodeClick={handleNodeClickInternal}
          onNodeHover={handleNodeHover}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          cooldownTicks={220}
          backgroundColor="transparent"
          d3AlphaDecay={0.018}
          d3VelocityDecay={0.32}
          warmupTicks={90}
          cooldownTime={3400}
        />
      </div>

      {/* Hover card */}
      {hoveredNode && (
        <div className="absolute bottom-3 left-3 z-10 max-w-[280px] bg-background/95 border border-border rounded-lg p-3 backdrop-blur-sm">
          <div
            className="label mb-1"
            style={{ color: getNodeColor(hoveredNode) }}
          >
            {hoveredNode.type === "writing" ? "Essay" : hoveredNode.type}
          </div>
          <div className="font-heading font-semibold text-sm mb-1">
            {hoveredNode.title}
          </div>
          {hoveredNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {hoveredNode.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 border border-border rounded text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted line-clamp-2">{hoveredNode.excerpt}</p>
          {hoveredNode.type === "writing" && (
            <p className="text-xs mt-1.5" style={{ color: WRITING_COLOR }}>
              Read on the blog ↗
            </p>
          )}
        </div>
      )}
    </div>
  );
}
