"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  endpointId,
  getNodeColor,
  getNodeSize,
  DUE_COLOR,
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
  // When set, only these nodes (a selected node + its neighbors) are spotlit.
  focusIds: Set<string> | null;
  // The clicked node inside the focus set — gets the strongest treatment.
  selectedId: string | null;
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

// Dim levels for the two spotlight modes. Hover keeps the rest of the map
// faintly readable; focus (click) pushes it further back but never to zero —
// the graph should feel dimmed, not amputated.
const HOVER_DIM_ALPHA = 0.15;
const HOVER_DIM_LINK_ALPHA = 0.06;
const FOCUS_DIM_ALPHA = 0.08;
const FOCUS_DIM_LINK_ALPHA = 0.04;

export default function KnowledgeGraph({
  data,
  searchQuery,
  dimensions,
  hoveredNode,
  focusIds,
  selectedId,
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

  // 1-hop adjacency for the hover spotlight, endpoint-shape tolerant.
  const adjacency = useMemo(() => {
    const adj = new Map<string, Set<string>>();
    for (const link of data.links) {
      const s = endpointId(link.source);
      const t = endpointId(link.target);
      if (!adj.has(s)) adj.set(s, new Set());
      if (!adj.has(t)) adj.set(t, new Set());
      adj.get(s)!.add(t);
      adj.get(t)!.add(s);
    }
    return adj;
  }, [data.links]);

  // The hovered node's neighborhood. Spotlight only applies outside focus mode —
  // focus (click) already owns the dimming.
  const hoverSet = useMemo(() => {
    if (!hoveredNode || focusIds) return null;
    const set = new Set(adjacency.get(hoveredNode.id) ?? []);
    set.add(hoveredNode.id);
    return set;
  }, [hoveredNode, focusIds, adjacency]);

  // Breathing ring on due-for-review ideas. force-graph pauses its redraw loop
  // when idle (autoPauseRedraw), but a nodeCanvasObject identity change marks
  // the canvas dirty — so a low-rate tick re-renders ~9x/s only while there are
  // due nodes and the tab is visible, instead of a permanent 60fps loop.
  const hasDue = useMemo(() => data.nodes.some((n) => n.dueForReview), [data.nodes]);
  const [pulseTick, setPulseTick] = useState(0);
  useEffect(() => {
    if (!hasDue) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => setPulseTick((t) => t + 1), 110);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () =>
      document.visibilityState === "visible" ? start() : stop();
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hasDue]);

  // measureText is surprisingly expensive at ~280 nodes × 60fps, and label
  // widths only depend on the (static) title. Measure once at a 10px reference
  // size and scale linearly with the actual font size.
  const labelWidthCache = useRef(new Map<string, number>());
  useEffect(() => {
    labelWidthCache.current.clear();
  }, [data.nodes]);

  // Frame the bulk of the graph, not its outliers: a lone two-node island
  // flung to the edge would otherwise dictate the zoom and shrink the core
  // to a thumbnail. Nodes beyond 2.5× the RMS radius are left off-frame.
  const makeFitFilter = useCallback(() => {
    const pts = data.nodes.filter(
      (n) => Number.isFinite((n as any).x) && Number.isFinite((n as any).y)
    ) as Array<GraphNode & { x: number; y: number }>;
    if (pts.length === 0) return () => true;
    const cx = pts.reduce((s, n) => s + n.x, 0) / pts.length;
    const cy = pts.reduce((s, n) => s + n.y, 0) / pts.length;
    const rms = Math.sqrt(
      pts.reduce((s, n) => s + (n.x - cx) ** 2 + (n.y - cy) ** 2, 0) / pts.length
    );
    const maxD = Math.max(rms * 2.5, 200);
    return (n: any) =>
      Number.isFinite(n.x) && Math.hypot(n.x - cx, n.y - cy) <= maxD;
  }, [data.nodes]);

  // Reset view: smoothly re-fit the whole graph. The prev-signal guard keeps
  // a remount (2D/3D toggle) from replaying the last reset against unsettled
  // node positions.
  const prevFitSignalRef = useRef(fitSignal);
  useEffect(() => {
    if (fitSignal === prevFitSignalRef.current) return;
    prevFitSignalRef.current = fitSignal;
    fgRef.current?.zoomToFit?.(600, 60, makeFitFilter());
  }, [fitSignal, makeFitFilter]);

  // Tune the layout as soon as the (dynamically imported) graph instance
  // exists, then reheat so the simulation settles under the tuned forces.
  // Polls on setTimeout, NOT requestAnimationFrame: rAF freezes entirely in
  // hidden tabs, and a background-loaded page would otherwise never get its
  // forces configured.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const apply = () => {
      const fg = fgRef.current;
      if (!fg) {
        timer = setTimeout(apply, 50);
        return;
      }
      fg.d3Force("charge")?.strength(-82).distanceMax(340);
      fg.d3Force("link")?.distance(44).strength(0.55);
      fg.d3Force("center")?.strength(0.6);
      // Gentle pull toward the origin. forceCenter only recenters the mean —
      // it never compresses spread — so weakly-connected satellite clusters
      // drift far out and force zoomToFit to shrink the main cloud to fit
      // them. This keeps the whole map framable without crushing the core.
      fg.d3Force("pullin", (alpha: number) => {
        for (const n of data.nodes as Array<
          GraphNode & { x?: number; y?: number; vx?: number; vy?: number }
        >) {
          if (n.x === undefined || n.y === undefined) continue;
          n.vx! -= n.x * 0.08 * alpha;
          n.vy! -= n.y * 0.08 * alpha;
        }
      });
      fg.d3ReheatSimulation();
    };
    apply();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [data]);

  // Two-stage framing, each once per dataset: an instant rough fit on the
  // first engine tick (post-warmup positions are already ballpark, so the
  // camera is never far off), then a smooth exact fit when the layout settles.
  // Drags re-stop the engine and must not yank the camera back to the overview.
  const didEarlyFitRef = useRef(false);
  const didFitRef = useRef(false);
  useEffect(() => {
    didEarlyFitRef.current = false;
    didFitRef.current = false;
  }, [data]);
  const handleEngineTick = useCallback(() => {
    if (didEarlyFitRef.current) return;
    didEarlyFitRef.current = true;
    if (data.nodes.length > 0) fgRef.current?.zoomToFit?.(0, 80, makeFitFilter());
  }, [data.nodes.length, makeFitFilter]);
  const handleEngineStop = useCallback(() => {
    if (didFitRef.current || data.nodes.length === 0) return;
    didFitRef.current = true;
    fgRef.current?.zoomToFit?.(550, 80, makeFitFilter());
  }, [data.nodes.length, makeFitFilter]);

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
      const color = getNodeColor(graphNode);
      const nodeSize = getNodeSize(graphNode);
      const isHovered = hoveredNode?.id === graphNode.id;
      const isSelected = selectedId === graphNode.id;
      const isSearchHit =
        !!searchQuery &&
        graphNode.title.toLowerCase().includes(searchQuery.toLowerCase());

      // Spotlight dimming: focus (click) outranks hover. Dimmed nodes keep
      // their shape and color — just pushed into the background.
      let alpha = 1;
      if (focusIds && !focusIds.has(graphNode.id)) alpha = FOCUS_DIM_ALPHA;
      else if (hoverSet && !hoverSet.has(graphNode.id)) alpha = HOVER_DIM_ALPHA;

      const cx = node.x || 0;
      const cy = node.y || 0;
      // The selected node reads as the center of gravity: slightly larger.
      const r = isSelected ? nodeSize * 1.2 : isHovered ? nodeSize + 1.3 : nodeSize;
      const isWriting = graphNode.type === "writing";
      const isSource = graphNode.type === "source";

      ctx.globalAlpha = alpha;
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

      // Nodes always keep their category color; states express themselves as
      // rings. (shadowBlur glows were the dominant per-frame cost here.)
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = isHovered || isSelected ? 1.8 / globalScale : 1 / globalScale;
      ctx.strokeStyle =
        isHovered || isSelected ? color : "rgba(180, 168, 148, 0.3)";
      ctx.stroke();

      // Ring halo radius clears every silhouette (diamond tips reach r*1.3).
      // Ring OFFSETS are in graph units so halos hug their nodes at any zoom;
      // only stroke widths stay in screen units for legibility.
      const haloBase = r * 1.45;

      if (isSearchHit && alpha === 1) {
        // Gold ring marks matches without erasing the node's type color.
        ctx.beginPath();
        ctx.arc(cx, cy, haloBase + 1.2, 0, 2 * Math.PI);
        ctx.strokeStyle = SEARCH_HIT_COLOR;
        ctx.lineWidth = 1.6 / globalScale;
        ctx.stroke();
      }

      if (isHovered || isSelected) {
        // Two-stroke halo: a crisp ring plus a wider soft one.
        ctx.beginPath();
        ctx.arc(cx, cy, haloBase + 1.2, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4 / globalScale;
        ctx.globalAlpha = alpha * 0.9;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, haloBase + 2.8, 0, 2 * Math.PI);
        ctx.lineWidth = 2.6 / globalScale;
        ctx.globalAlpha = alpha * 0.25;
        ctx.stroke();
        ctx.globalAlpha = alpha;
      }

      // Due-for-review ideas breathe: an amber ring that swells and fades on
      // the low-rate pulse tick. Deliberately quiet — with many ideas due at
      // once the rings must read as a shimmer over the map, not a sea of
      // alarms. Skipped while dimmed: background nodes shouldn't call for
      // attention.
      if (graphNode.dueForReview && alpha === 1 && !isSelected) {
        const breath = 0.5 + 0.5 * Math.sin(pulseTick * 0.28);
        ctx.beginPath();
        ctx.arc(cx, cy, haloBase + 0.6 + breath * 1.1, 0, 2 * Math.PI);
        ctx.strokeStyle = DUE_COLOR;
        ctx.lineWidth = (0.9 + breath * 0.5) / globalScale;
        ctx.globalAlpha = 0.16 + breath * 0.3;
        ctx.stroke();
        ctx.globalAlpha = alpha;
      }

      // Labels on hover/search/focus always; otherwise ranked reveal — the
      // most-connected hubs (sources, essays, big concepts) get named first,
      // and zooming in raises the budget. Dimmed nodes never get labels.
      const shouldRenderLabel =
        alpha === 1 &&
        ((focusIds?.has(graphNode.id) ?? false) ||
          isHovered ||
          isSearchHit ||
          (labelRank.get(graphNode.id) ?? Infinity) < labelBudget(globalScale));
      if (!shouldRenderLabel) {
        ctx.globalAlpha = 1;
        return;
      }

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
      ctx.globalAlpha = 1;
    },
    [hoveredNode, hoverSet, searchQuery, focusIds, selectedId, labelRank, pulseTick]
  );

  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      // Force-graph adds x/y to nodes at runtime; the static type omits them.
      const source = link.source as GraphNode & { x?: number; y?: number };
      const target = link.target as GraphNode & { x?: number; y?: number };

      if (
        source.x === undefined ||
        source.y === undefined ||
        target.x === undefined ||
        target.y === undefined
      ) {
        return;
      }

      const inFocus =
        !focusIds || (focusIds.has(source.id) && focusIds.has(target.id));
      const connectedToHovered =
        hoveredNode &&
        (source.id === hoveredNode.id || target.id === hoveredNode.id);

      // Heavier wikilink multiplicity draws a heavier strand.
      const weight = Math.min((link.weight ?? 1) - 1, 3);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      if (focusIds && !inFocus) {
        ctx.strokeStyle = `rgba(180, 168, 148, ${FOCUS_DIM_LINK_ALPHA})`;
        ctx.lineWidth = 0.8 / globalScale;
      } else if (connectedToHovered) {
        ctx.strokeStyle = "rgba(139, 105, 20, 0.65)";
        ctx.lineWidth = (1.6 + weight * 0.35) / globalScale;
      } else if (hoverSet) {
        ctx.strokeStyle = `rgba(180, 168, 148, ${HOVER_DIM_LINK_ALPHA})`;
        ctx.lineWidth = 0.8 / globalScale;
      } else {
        ctx.strokeStyle = `rgba(180, 168, 148, ${0.18 + weight * 0.07})`;
        ctx.lineWidth = (0.8 + weight * 0.35) / globalScale;
      }
      ctx.stroke();
    },
    [hoveredNode, hoverSet, focusIds]
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
          // Out-of-focus nodes get no pointer area, so they can't be hovered/clicked.
          if (focusIds && !focusIds.has((node as GraphNode).id)) return;
          ctx.beginPath();
          ctx.arc(
            node.x || 0,
            node.y || 0,
            getNodeSize(node as GraphNode) + 6,
            0,
            2 * Math.PI
          );
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkCanvasObject={linkCanvasObject}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClickInternal}
        onNodeHover={handleNodeHover}
        onBackgroundClick={onBackgroundClick}
        onEngineTick={handleEngineTick}
        onEngineStop={handleEngineStop}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        minZoom={0.15}
        maxZoom={10}
        // Tick-count cooldown only (no short wall-clock cap): cooldownTime is
        // measured in wall time, so a background tab whose rAF loop was frozen
        // would "time out" instantly on wake and stop the engine mid-layout.
        // 220 ticks ≈ 3.7s of actual simulation regardless of tab visibility.
        cooldownTicks={220}
        backgroundColor="transparent"
        d3AlphaDecay={0.018}
        d3VelocityDecay={0.32}
        warmupTicks={90}
      />
    </div>
  );
}
