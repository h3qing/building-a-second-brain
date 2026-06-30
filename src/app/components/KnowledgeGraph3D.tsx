"use client";

// This module is only ever loaded client-side (the parent imports it via
// next/dynamic with ssr:false), so a static import of the WebGL graph + three
// is safe and keeps the heavy 3D bundle out of the initial page load.
import { useCallback, useEffect, useRef } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import SpriteText from "three-spritetext";
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

// A node's title only shows once the camera is within this fraction of the
// graph radius — so labels reveal as you fly in, instead of cluttering the
// zoomed-out overview. Tune up to reveal labels sooner.
const LABEL_VISIBLE_FACTOR = 0.7;

function makeLabel(n: GraphNode): SpriteText {
  const text = n.title.length > 30 ? `${n.title.slice(0, 30)}…` : n.title;
  const label = new SpriteText(text);
  label.color = "rgba(250, 248, 245, 0.96)";
  label.backgroundColor = "rgba(26, 24, 18, 0.82)";
  label.padding = 2;
  label.borderRadius = 3;
  label.textHeight = 5;
  // Float the label above the node (essays are larger octahedra).
  const size = getNodeSize(n);
  label.position.set(0, size + (n.type === "writing" ? size * 0.9 : 4), 0);
  label.visible = false; // revealed by distance, see updateLabels()
  label.userData.isNodeLabel = true;
  label.renderOrder = 10;
  return label;
}

export default function KnowledgeGraph3D({
  data,
  searchQuery,
  dimensions,
  onNodeHover,
  onNodeClick,
}: KnowledgeGraph3DProps) {
  const fgRef = useRef<any>(null);
  const thresholdRef = useRef(90);
  const query = searchQuery.trim().toLowerCase();

  const isSearchHit = useCallback(
    (node: GraphNode) => !!query && node.title.toLowerCase().includes(query),
    [query]
  );

  // Essays render as octahedra (the 3D echo of the 2D diamond) with a label;
  // concepts and ideas keep the library's default sphere (via nodeVal/nodeColor)
  // and get the label appended on top (nodeThreeObjectExtend below).
  const nodeThreeObject = useCallback(
    (node: any) => {
      const n = node as GraphNode;
      const label = makeLabel(n);
      if (n.type !== "writing") return label;

      const size = getNodeSize(n) * 1.4;
      const color = isSearchHit(n) ? SEARCH_HIT_COLOR : getNodeColor(n);
      const group = new THREE.Group();
      group.add(
        new THREE.Mesh(
          new THREE.OctahedronGeometry(size),
          new THREE.MeshLambertMaterial({ color })
        )
      );
      group.add(label);
      return group;
    },
    [isSearchHit]
  );

  const nodeThreeObjectExtend = useCallback(
    (node: any) => (node as GraphNode).type !== "writing",
    []
  );

  // Show a node's label only when the camera is close enough to it.
  const updateLabels = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const cam = fg.camera?.();
    const scene = fg.scene?.();
    if (!cam || !scene) return;
    const world = new THREE.Vector3();
    const threshold = thresholdRef.current;
    scene.traverse((obj: any) => {
      if (obj.userData?.isNodeLabel) {
        obj.getWorldPosition(world);
        obj.visible = world.distanceTo(cam.position) < threshold;
      }
    });
  }, []);

  // Once the simulation settles, size the reveal distance to the actual graph
  // extent so it works regardless of node count / force scale.
  const handleEngineStop = useCallback(() => {
    let radius = 0;
    for (const n of data.nodes as Array<GraphNode & { x?: number; y?: number; z?: number }>) {
      const d = Math.hypot(n.x ?? 0, n.y ?? 0, n.z ?? 0);
      if (d > radius) radius = d;
    }
    thresholdRef.current = radius > 0 ? radius * LABEL_VISIBLE_FACTOR : 90;
    updateLabels();
  }, [data.nodes, updateLabels]);

  // Re-evaluate label visibility whenever the camera moves (zoom/rotate/pan).
  useEffect(() => {
    const controls = fgRef.current?.controls?.();
    if (!controls?.addEventListener) return;
    controls.addEventListener("change", updateLabels);
    return () => controls.removeEventListener("change", updateLabels);
  }, [updateLabels]);

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
        ref={fgRef}
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
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={nodeThreeObjectExtend}
        onEngineStop={handleEngineStop}
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
