"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import KnowledgeGraph from "./KnowledgeGraph";
import GraphErrorBoundary from "./GraphErrorBoundary";
import {
  filterGraph,
  CONCEPT_COLOR,
  IDEA_COLOR,
  WRITING_COLOR,
  SOURCE_COLOR,
  DUE_COLOR,
  getNodeColor,
  type FilteredGraph,
  type GraphNode,
} from "@/lib/graph";

// The 3D renderer (and three.js) loads only when the user switches to 3D, so it
// never weighs down the default 2D view.
const KnowledgeGraph3D = dynamic(() => import("./KnowledgeGraph3D"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      Loading 3D…
    </div>
  ),
});

type Mode = "2d" | "3d";

function getFullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element };
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export default function GraphSection({ data }: { data: FilteredGraph }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<Mode>("2d");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [fitSignal, setFitSignal] = useState(0);

  // Debounce the query before filtering: every filteredData change re-heats the
  // force simulation, so filtering per keystroke would shuffle the layout while
  // the user types.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const filteredData = useMemo(
    () => filterGraph(data, debouncedQuery),
    [data, debouncedQuery]
  );

  // Spaced-repetition bridge: how many ideas on the map are due today.
  const dueCount = useMemo(
    () => data.nodes.filter((n) => n.dueForReview).length,
    [data.nodes]
  );

  // The selected node + its immediate neighbors. When set, the renderers hide
  // everything else and label the rest.
  const focusIds = useMemo(() => {
    if (!selectedNode) return null;
    const ids = new Set<string>([selectedNode.id]);
    for (const link of filteredData.links) {
      const s = typeof link.source === "string" ? link.source : (link.source as GraphNode).id;
      const t = typeof link.target === "string" ? link.target : (link.target as GraphNode).id;
      if (s === selectedNode.id) ids.add(t);
      else if (t === selectedNode.id) ids.add(s);
    }
    return ids;
  }, [selectedNode, filteredData.links]);

  const clearSelection = useCallback(() => setSelectedNode(null), []);

  // Reset view: clear any focus and re-fit the whole graph.
  const resetView = useCallback(() => {
    setSelectedNode(null);
    setFitSignal((s) => s + 1);
  }, []);

  const updateDimensions = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (getFullscreenElement() === el) {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    } else {
      const { width } = el.getBoundingClientRect();
      // Taller now that the graph is the homepage centerpiece; the floor keeps
      // it usable on narrow phones.
      setDimensions({ width, height: Math.max(340, Math.min(620, width * 0.6)) });
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(getFullscreenElement() === containerRef.current);
      updateDimensions();
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("resize", updateDimensions);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [updateDimensions]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => void })
      | null;
    if (!el) return;
    const doc = document as Document & { webkitExitFullscreen?: () => void };
    if (getFullscreenElement()) {
      (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc);
    } else {
      (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
    }
  }, []);

  // Clicking a node opens a detail card instead of navigating away; the card's
  // link performs the actual drill-in.
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  const drillIn = useCallback(
    (node: GraphNode) => {
      if (node.type === "writing") {
        if (node.url) window.open(node.url, "_blank", "noopener,noreferrer");
      } else if (node.type === "concept") {
        router.push(`/concepts/${node.slug}`);
      } else {
        router.push(`/ideas/${node.slug}`);
      }
    },
    [router]
  );

  const drillInLabel = (node: GraphNode) =>
    node.type === "writing"
      ? "Read on the blog ↗"
      : node.type === "concept"
        ? "Open concept →"
        : "Open idea →";

  // Drop the selection if a search filters it out of view.
  useEffect(() => {
    if (selectedNode && !filteredData.nodes.some((n) => n.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [filteredData, selectedNode]);

  // Esc closes the detail card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedNode(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative border border-border overflow-hidden bg-card ${
        isFullscreen ? "rounded-none" : "rounded-lg"
      }`}
    >
      {/* Search */}
      <div className="absolute top-3 left-3 z-10">
        <input
          type="text"
          placeholder="Search notes..."
          aria-label="Search the knowledge graph"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 text-sm bg-background/90 border border-border rounded-md backdrop-blur-sm focus:outline-none focus:border-accent"
        />
      </div>

      {/* Controls: 2D/3D toggle + fullscreen */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <div className="flex items-center bg-background/90 border border-border rounded-md backdrop-blur-sm overflow-hidden text-xs">
          {(["2d", "3d"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-2.5 py-1 transition-colors ${
                mode === m
                  ? "bg-accent/15 text-accent font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset view"
          title="Reset view"
          className="flex items-center justify-center w-7 h-7 bg-background/90 border border-border rounded-md backdrop-blur-sm text-muted hover:text-accent transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="flex items-center justify-center w-7 h-7 bg-background/90 border border-border rounded-md backdrop-blur-sm text-muted hover:text-accent transition-colors"
        >
          {isFullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          )}
        </button>
      </div>

      {/* Renderer */}
      {mode === "3d" ? (
        <GraphErrorBoundary
          fallback={
            <div
              style={{ height: dimensions.height }}
              className="flex flex-col items-center justify-center gap-3 text-center text-muted text-sm px-6"
            >
              <p>The 3D view needs WebGL, which isn’t available in this browser.</p>
              <button
                type="button"
                onClick={() => setMode("2d")}
                className="px-3 py-1.5 text-sm bg-background/90 border border-border rounded-md text-accent hover:border-accent transition-colors"
              >
                Back to 2D
              </button>
            </div>
          }
        >
          <KnowledgeGraph3D
            data={filteredData}
            searchQuery={debouncedQuery}
            dimensions={dimensions}
            focusIds={focusIds}
            fitSignal={fitSignal}
            onNodeHover={setHoveredNode}
            onNodeClick={handleNodeClick}
            onBackgroundClick={clearSelection}
          />
        </GraphErrorBoundary>
      ) : (
        <KnowledgeGraph
          data={filteredData}
          searchQuery={debouncedQuery}
          dimensions={dimensions}
          hoveredNode={hoveredNode}
          focusIds={focusIds}
          selectedId={selectedNode?.id ?? null}
          fitSignal={fitSignal}
          onNodeHover={setHoveredNode}
          onNodeClick={handleNodeClick}
          onBackgroundClick={clearSelection}
        />
      )}

      {/* Stats + due chip + legend */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-1.5">
        {dueCount > 0 && (
          <Link
            href="/review"
            className="text-xs font-medium bg-background/90 border rounded-full px-3 py-1 backdrop-blur-sm transition-colors hover:bg-background"
            style={{ color: DUE_COLOR, borderColor: DUE_COLOR }}
          >
            {dueCount} due for review →
          </Link>
        )}
        <div className="text-xs text-muted bg-background/90 border border-border rounded-full px-3 py-1 backdrop-blur-sm">
          {filteredData.nodes.length} nodes · {filteredData.links.length} links
        </div>
        <div className="flex flex-col gap-1 text-xs bg-background/90 border border-border rounded-lg px-3 py-2 backdrop-blur-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 flex items-center justify-center">
              {/* Circle, matching what the canvas actually draws for concepts. */}
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: CONCEPT_COLOR }} />
            </span>
            <span className="text-foreground">concept</span>
            <span className="text-muted">synthesized</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 flex items-center justify-center">
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: IDEA_COLOR }} />
            </span>
            <span className="text-foreground">idea</span>
            <span className="text-muted">atomic insight</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 flex items-center justify-center">
              <span style={{ width: 9, height: 9, background: WRITING_COLOR, transform: "rotate(45deg)" }} />
            </span>
            <span className="text-foreground">essay</span>
            <span className="text-muted">published</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 flex items-center justify-center">
              <span style={{ width: 9, height: 9, background: SOURCE_COLOR }} />
            </span>
            <span className="text-foreground">source</span>
            <span className="text-muted">book · podcast</span>
          </span>
          {dueCount > 0 && (
            <span className="flex items-center gap-2">
              <span className="w-3 flex items-center justify-center">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: `2px solid ${DUE_COLOR}`,
                  }}
                />
              </span>
              <span className="text-foreground">glowing</span>
              <span className="text-muted">due for review</span>
            </span>
          )}
        </div>
      </div>

      {/* Hover card — hidden while a node is selected (the detail card takes over) */}
      {hoveredNode && !selectedNode && (
        <div className="absolute bottom-3 left-3 z-10 max-w-[280px] bg-background/95 border border-border rounded-lg p-3 backdrop-blur-sm">
          <div className="label mb-1" style={{ color: getNodeColor(hoveredNode) }}>
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

      {/* Detail card — opened on click, with a drill-in link */}
      {selectedNode && (
        <div className="absolute bottom-3 left-3 z-20 w-[300px] max-w-[calc(100%-1.5rem)] bg-background/95 border border-border rounded-lg p-3.5 backdrop-blur-sm shadow-lg">
          <button
            type="button"
            onClick={() => setSelectedNode(null)}
            aria-label="Close"
            className="absolute top-2.5 right-2.5 text-muted hover:text-foreground transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="label mb-1" style={{ color: getNodeColor(selectedNode) }}>
            {selectedNode.type === "writing" ? "Essay" : selectedNode.type}
          </div>
          <div className="font-heading font-semibold text-base mb-1.5 pr-5">
            {selectedNode.title}
          </div>
          {selectedNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedNode.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 border border-border rounded text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {selectedNode.excerpt && (
            <p className="text-xs text-muted leading-relaxed mb-2.5 line-clamp-4">
              {selectedNode.excerpt}
            </p>
          )}
          {/* Sources are synthetic hubs with no page of their own — no drill-in. */}
          <div className="flex items-center gap-3">
            {selectedNode.type !== "source" && (
              <button
                type="button"
                onClick={() => drillIn(selectedNode)}
                className="text-sm font-medium hover:underline"
                style={{ color: getNodeColor(selectedNode) }}
              >
                {drillInLabel(selectedNode)}
              </button>
            )}
            {/* Ideas jump straight into a recall session on their card. */}
            {selectedNode.type === "idea" && selectedNode.path && (
              <Link
                href={`/review/card?${new URLSearchParams({
                  path: selectedNode.path,
                  mode: "rereview",
                })}`}
                className="text-sm font-medium hover:underline"
                style={{ color: DUE_COLOR }}
              >
                {selectedNode.dueForReview ? "Due — review now ↻" : "Review now ↻"}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
