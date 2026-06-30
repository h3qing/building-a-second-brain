"use client";

// This module is only ever loaded client-side (the parent imports it via
// next/dynamic with ssr:false), so a static import of the WebGL graph + three
// is safe and keeps the heavy 3D bundle out of the initial page load.
import { useCallback } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import {
  getNodeColor,
  getNodeSize,
  SEARCH_HIT_COLOR,
  type FilteredGraph,
  type GraphNode,
} from "@/lib/graph";

interface KnowledgeGraph3DProps {
  data: FilteredGraph;
  searchQuery: string;
  dimensions: { width: number; height: number };
  onNodeHover: (node: GraphNode | null) => void;
  onNodeClick: (node: GraphNode) => void;
}

export default function KnowledgeGraph3D({
  data,
  searchQuery,
  dimensions,
  onNodeHover,
  onNodeClick,
}: KnowledgeGraph3DProps) {
  const query = searchQuery.trim().toLowerCase();

  const isSearchHit = useCallback(
    (node: GraphNode) =>
      !!query && node.title.toLowerCase().includes(query),
    [query]
  );

  // Essays render as octahedra (the 3D echo of the 2D diamond); concepts and
  // ideas fall through to the library's default sphere via nodeColor/nodeVal.
  const nodeThreeObject = useCallback(
    (node: any) => {
      const n = node as GraphNode;
      if (n.type !== "writing") return undefined;
      const size = getNodeSize(n) * 1.4;
      const color = isSearchHit(n) ? SEARCH_HIT_COLOR : getNodeColor(n);
      return new THREE.Mesh(
        new THREE.OctahedronGeometry(size),
        new THREE.MeshLambertMaterial({ color })
      );
    },
    [isSearchHit]
  );

  const handleHover = useCallback(
    (node: any) => {
      onNodeHover((node as GraphNode | null) || null);
      document.body.style.cursor = node ? "pointer" : "default";
    },
    [onNodeHover]
  );

  const handleClick = useCallback(
    (node: any) => onNodeClick(node as GraphNode),
    [onNodeClick]
  );

  return (
    <div style={{ width: "100%", height: dimensions.height }}>
      <ForceGraph3D
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        nodeId="id"
        nodeLabel=""
        nodeVal={(n: any) => getNodeSize(n as GraphNode)}
        nodeColor={(n: any) =>
          isSearchHit(n as GraphNode)
            ? SEARCH_HIT_COLOR
            : getNodeColor(n as GraphNode)
        }
        nodeOpacity={0.92}
        // Returning undefined for non-essays falls back to the default sphere;
        // the lib supports this at runtime but its type insists on an Object3D.
        nodeThreeObject={nodeThreeObject as any}
        nodeThreeObjectExtend={false}
        linkColor={() => "rgba(180, 168, 148, 0.35)"}
        linkWidth={0.5}
        linkOpacity={0.4}
        onNodeHover={handleHover}
        onNodeClick={handleClick}
        enableNodeDrag={false}
        showNavInfo={false}
        backgroundColor="rgba(0,0,0,0)"
      />
    </div>
  );
}
