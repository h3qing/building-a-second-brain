"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  getNodeColor,
  getNodeSize,
  SEARCH_HIT_COLOR,
  type FilteredGraph,
  type GraphNode,
} from "@/lib/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      Loading graph...
    </div>
  ),
});

interface KnowledgeGraphProps {
  data: FilteredGraph;
  searchQuery: string;
  dimensions: { width: number; height: number };
  hoveredNode: GraphNode | null;
  // When set, only these nodes (a selected node + its neighbors) are drawn.
  focusIds: Set<string> | null;
  // Incrementing counter: each bump re-fits the graph (used by Reset view).
  fitSignal: number;
  onNodeHover: (node: GraphNode | null) => void;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick: () => void;
}

// How many labels are visible at a given zoom. Zoomed out, only the top hubs
// are named; zooming in reveals progressively more, and only past ~3.2x does
// every node get a label. Keeps the default view readable instead of a text wall.
function labelBudget(scale: number): number {
  if (scale < 1.35) return 0;
  if (scale < 2.2) return 18;
  if (scale < 3.2) return 60;
  return Infinity;
}

export default function KnowledgeGraph({
  data,
  searchQuery,
  dimensions,
  hoveredNode,
  focusIds,
  fitSignal,
  onNodeHover,
  onNodeClick,
  onBackgroundClick,
}: KnowledgeGraphProps) {
  const fgRef = useRef<any>(null);

  // Label priority: sources and essays anchor the map, then by connectivity.
  // Rank is static per dataset, so it's computed once, not per frame.
  const labelRank = useMemo(() => {
    const anchor = (n: GraphNode) =>
      n.type === "source" || n.type === "writing" ? 1000 : 0;
    const ranked = [...data.nodes].sort(
      (a, b) =>
        anchor(b) + b.linkCount - (anchor(a) + a.linkCount) ||
        a.id.localeCompare(b.id)
    );
    const rank = new Map<string, number>();
    ranked.forEach((n, i) => rank.set(n.id, i));
    return rank;
  }, [data.nodes]);

  // measureText is surprisingly expensive at ~280 nodes × 60fps, and label
  // widths only depend on the (static) title. Measure once at a 10px reference
  // size and scale linearly with the actual font size.
  const labelWidthCache = useRef(new Map<string, number>());
  useEffect(() => {
    labelWidthCache.current.clear();
  }, [data.nodes]);

  // Reset view: smoothly re-fit the whole graph. The prev-signal guard keeps
  // a remount (2D/3D toggle) from replaying the last reset against unsettled
  // node positions.
  const prevFitSignalRef = useRef(fitSignal);
  useEffect(() => {
    if (fitSignal === prevFitSignalRef.current) return;
    prevFitSignalRef.current = fitSignal;
    fgRef.current?.zoomToFit?.(600, 60);
  }, [fitSignal]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fgRef.current) return;
      fgRef.current.d3Force("charge")?.strength(-82).distanceMax(340);
      fgRef.current.d3Force("link")?.distance(44).strength(0.55);
      fgRef.current.d3Force("center")?.strength(0.6);
      fgRef.current.d3ReheatSimulation();

      if (data.nodes.length > 0) {
        setTimeout(() => {
          fgRef.current?.zoomToFit(550, 80);
        }, 650);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [data.nodes.length]);

  const handleNodeHover = useCallback(
    (node: any) => {
      onNodeHover((node as GraphNode | null) || null);
      document.body.style.cursor = node ? "pointer" : "default";
    },
    [onNodeHover]
  );

  const handleNodeClickInternal = useCallback(
    (node: any) => {
      if (node.x !== undefined && node.y !== undefined && fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 350);
      }
      onNodeClick(node as GraphNode);
    },
    [onNodeClick]
  );

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GraphNode;
      // Focus mode: hide everything except the selected node and its neighbors.
      if (focusIds && !focusIds.has(graphNode.id)) return;
      const color = getNodeColor(graphNode);
      const nodeSize = getNodeSize(graphNode);
      const isHovered = hoveredNode?.id === graphNode.id;
      const isSearchHit =
        !!searchQuery &&
        graphNode.title.toLowerCase().includes(searchQuery.toLowerCase());

      const cx = node.x || 0;
      const cy = node.y || 0;
      const r = isHovered ? nodeSize + 1.3 : nodeSize;
      const isWriting = graphNode.type === "writing";
      const isSource = graphNode.type === "source";

      ctx.beginPath();
      if (isWriting) {
        // Diamonds mark published essays — distinct from concept/idea circles.
        const d = r * 1.3;
        ctx.moveTo(cx, cy - d);
        ctx.lineTo(cx + d, cy);
        ctx.lineTo(cx, cy + d);
        ctx.lineTo(cx - d, cy);
        ctx.closePath();
      } else if (isSource) {
        // Squares mark sources (books/podcasts) — the hubs ideas hang off.
        const s = r * 0.95;
        ctx.rect(cx - s, cy - s, s * 2, s * 2);
      } else {
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      }

      if (isHovered) {
        ctx.fillStyle = "#faf8f5";
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
      } else if (isSearchHit) {
        ctx.fillStyle = SEARCH_HIT_COLOR;
        ctx.shadowColor = SEARCH_HIT_COLOR;
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

      // Labels on hover/search/focus always; otherwise ranked reveal — the
      // most-connected hubs (sources, essays, big concepts) get named first,
      // and zooming in raises the budget. All-at-once labeling past one zoom
      // threshold was both a text wall and a per-frame measureText storm.
      const shouldRenderLabel =
        !!focusIds || // in focus mode every visible node is labeled
        isHovered ||
        isSearchHit ||
        (labelRank.get(graphNode.id) ?? Infinity) < labelBudget(globalScale);
      if (!shouldRenderLabel) return;

      const rawLabel =
        graphNode.title.length > 34
          ? `${graphNode.title.slice(0, 34)}...`
          : graphNode.title;
      const fontSize = Math.max(11 / globalScale, 5.5);
      const y = (node.y || 0) + nodeSize + 4 / globalScale;

      let refWidth = labelWidthCache.current.get(graphNode.id);
      if (refWidth === undefined) {
        ctx.font = `600 10px "Crimson Pro", Georgia, serif`;
        refWidth = ctx.measureText(rawLabel).width;
        labelWidthCache.current.set(graphNode.id, refWidth);
      }
      const textWidth = (refWidth * fontSize) / 10;

      ctx.font = `600 ${fontSize}px "Crimson Pro", Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
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
    [hoveredNode, searchQuery, focusIds, labelRank]
  );

  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      // Force-graph adds x/y to nodes at runtime; the static type omits them.
      const source = link.source as GraphNode & { x?: number; y?: number };
      const target = link.target as GraphNode & { x?: number; y?: number };

      // Focus mode: only draw links between two visible (focus) nodes.
      if (focusIds && !(focusIds.has(source.id) && focusIds.has(target.id))) {
        return;
      }

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
      ctx.lineWidth = connectedToHovered ? 1.6 / globalScale : 0.8 / globalScale;
      ctx.stroke();
    },
    [hoveredNode, focusIds]
  );

  return (
    <div
      style={{
        width: "100%",
        height: dimensions.height,
        cursor: hoveredNode ? "pointer" : "grab",
      }}
      // Clear the hover state when the pointer leaves the canvas — force-graph
      // only reports hover-off while the pointer stays inside it. Routed
      // through handleNodeHover so the body cursor resets too.
      onPointerLeave={() => handleNodeHover(null)}
    >
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        nodeId="id"
        nodeLabel=""
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          // Hidden nodes get no pointer area, so they can't be hovered/clicked.
          if (focusIds && !focusIds.has((node as GraphNode).id)) return;
          const size = Math.max(8, 4 + Math.sqrt(node.linkCount + 1) * 2.1);
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, size + 18, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkCanvasObject={linkCanvasObject}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClickInternal}
        onNodeHover={handleNodeHover}
        onBackgroundClick={onBackgroundClick}
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
  );
}
