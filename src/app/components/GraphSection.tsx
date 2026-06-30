"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import KnowledgeGraph from "./KnowledgeGraph";
import GraphErrorBoundary from "./GraphErrorBoundary";
import {
  filterGraph,
  CONCEPT_COLOR,
  IDEA_COLOR,
  WRITING_COLOR,
  getNodeColor,
  type GraphData,
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

export default function GraphSection({ data }: { data: GraphData }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<Mode>("2d");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  const filteredData = useMemo(
    () => filterGraph(data, searchQuery),
    [data, searchQuery]
  );

  const updateDimensions = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (getFullscreenElement() === el) {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    } else {
      const { width } = el.getBoundingClientRect();
      setDimensions({ width, height: Math.min(500, width * 0.65) });
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

  const handleNodeClick = useCallback(
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
          placeholder="Search concepts..."
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
            searchQuery={searchQuery}
            dimensions={dimensions}
            onNodeHover={setHoveredNode}
            onNodeClick={handleNodeClick}
          />
        </GraphErrorBoundary>
      ) : (
        <KnowledgeGraph
          data={filteredData}
          searchQuery={searchQuery}
          dimensions={dimensions}
          hoveredNode={hoveredNode}
          onNodeHover={setHoveredNode}
          onNodeClick={handleNodeClick}
        />
      )}

      {/* Stats + legend */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-1.5">
        <div className="text-xs text-muted bg-background/90 border border-border rounded-full px-3 py-1 backdrop-blur-sm">
          {filteredData.nodes.length} nodes · {filteredData.links.length} links
        </div>
        <div className="flex items-center gap-3 text-xs text-muted bg-background/90 border border-border rounded-full px-3 py-1 backdrop-blur-sm">
          <span className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: CONCEPT_COLOR }} />
            concept
          </span>
          <span className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: IDEA_COLOR }} />
            idea
          </span>
          <span className="flex items-center gap-1.5">
            <span style={{ width: 7, height: 7, background: WRITING_COLOR, transform: "rotate(45deg)" }} />
            essay
          </span>
        </div>
      </div>

      {/* Hover card */}
      {hoveredNode && (
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
    </div>
  );
}
