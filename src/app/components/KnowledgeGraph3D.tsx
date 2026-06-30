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
  // When set, only these nodes (a selected node + its neighbors) are shown.
  focusIds: Set<string> | null;
  // Incrementing counter: each bump re-frames the whole graph (used by Reset view).
  fitSignal: number;
  onNodeHover: (node: GraphNode | null) => void;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick: () => void;
}

// Labels reveal as the camera approaches: fully shown within FULL×radius, fading
// out by REVEAL×radius. The most-connected HUB_COUNT nodes are always labeled so
// the map reads even when zoomed out. Tune these to taste.
const LABEL_REVEAL_FACTOR = 1.15;
const LABEL_FULL_FACTOR = 0.55;
const HUB_COUNT = 12;
// How far the camera sits from a node when you click to focus it.
const FOCUS_CAMERA_DISTANCE = 90;

function makeNodeMesh(n: GraphNode, hit: boolean): THREE.Mesh {
  const base = getNodeSize(n);
  const color = hit ? SEARCH_HIT_COLOR : getNodeColor(n);
  // Distinct silhouette per type: faceted gem = concept, smooth orb = idea,
  // diamond (octahedron) = essay.
  let geometry: THREE.BufferGeometry;
  if (n.type === "concept") {
    geometry = new THREE.IcosahedronGeometry(base * 1.15, 0);
  } else if (n.type === "writing") {
    geometry = new THREE.OctahedronGeometry(base * 1.4, 0);
  } else {
    geometry = new THREE.SphereGeometry(base * 0.95, 16, 16);
  }
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: hit ? 0.6 : 0.35,
    roughness: 0.45,
    metalness: 0.1,
  });
  return new THREE.Mesh(geometry, material);
}

function makeLabel(n: GraphNode): SpriteText {
  const text = n.title.length > 30 ? `${n.title.slice(0, 30)}…` : n.title;
  const label = new SpriteText(text);
  label.color = "rgba(250, 248, 245, 0.96)";
  label.backgroundColor = "rgba(26, 24, 18, 0.82)";
  label.padding = 2;
  label.borderRadius = 3;
  label.textHeight = 5;
  label.position.set(0, getNodeSize(n) * 1.6 + 3, 0);
  label.material.transparent = true;
  label.material.opacity = 0;
  label.visible = false; // revealed by distance / focus, see updateLabels()
  label.userData.isNodeLabel = true;
  label.userData.nodeId = n.id;
  label.userData.linkCount = n.linkCount;
  label.renderOrder = 10;
  return label;
}

export default function KnowledgeGraph3D({
  data,
  searchQuery,
  dimensions,
  focusIds,
  fitSignal,
  onNodeHover,
  onNodeClick,
  onBackgroundClick,
}: KnowledgeGraph3DProps) {
  const fgRef = useRef<any>(null);
  const radiusRef = useRef(120);
  const hubCutoffRef = useRef(Infinity);
  // Mirror focusIds into a ref so the controls-change handler reads the latest.
  const focusRef = useRef<Set<string> | null>(focusIds);
  const query = searchQuery.trim().toLowerCase();

  const isSearchHit = useCallback(
    (node: GraphNode) => !!query && node.title.toLowerCase().includes(query),
    [query]
  );

  // Every node is a custom group: a type-specific mesh plus its label.
  const nodeThreeObject = useCallback(
    (node: any) => {
      const n = node as GraphNode;
      const group = new THREE.Group();
      group.add(makeNodeMesh(n, isSearchHit(n)));
      group.add(makeLabel(n));
      return group;
    },
    [isSearchHit]
  );

  // Label visibility: in focus mode show exactly the focused nodes' labels;
  // otherwise fade each label in as the camera approaches, and always show hubs.
  const updateLabels = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const cam = fg.camera?.();
    const scene = fg.scene?.();
    if (!cam || !scene) return;
    const world = new THREE.Vector3();
    const focus = focusRef.current;
    const revealDist = radiusRef.current * LABEL_REVEAL_FACTOR;
    const fullDist = radiusRef.current * LABEL_FULL_FACTOR;
    scene.traverse((obj: any) => {
      if (!obj.userData?.isNodeLabel) return;
      if (focus) {
        const on = focus.has(obj.userData.nodeId);
        obj.visible = on;
        obj.material.opacity = on ? 1 : 0;
        return;
      }
      let opacity: number;
      if (obj.userData.linkCount >= hubCutoffRef.current) {
        opacity = 1; // hubs anchor the map — always legible
      } else {
        obj.getWorldPosition(world);
        const d = world.distanceTo(cam.position);
        if (d >= revealDist) opacity = 0;
        else if (d <= fullDist) opacity = 1;
        else opacity = (revealDist - d) / (revealDist - fullDist);
      }
      obj.material.opacity = opacity;
      obj.visible = opacity > 0.04;
    });
  }, []);

  // Once the simulation settles, size the reveal distance to the actual graph
  // extent and pick the hub cutoff (the HUB_COUNT-th highest link count).
  const handleEngineStop = useCallback(() => {
    let radius = 0;
    const counts: number[] = [];
    for (const n of data.nodes as Array<GraphNode & { x?: number; y?: number; z?: number }>) {
      radius = Math.max(radius, Math.hypot(n.x ?? 0, n.y ?? 0, n.z ?? 0));
      counts.push(n.linkCount ?? 0);
    }
    radiusRef.current = radius > 0 ? radius : 120;
    counts.sort((a, b) => b - a);
    hubCutoffRef.current = counts.length
      ? counts[Math.min(HUB_COUNT, counts.length) - 1] || 1
      : Infinity;
    updateLabels();
  }, [data.nodes, updateLabels]);

  // Re-evaluate label visibility whenever the camera moves (zoom/rotate/pan).
  useEffect(() => {
    const controls = fgRef.current?.controls?.();
    if (!controls?.addEventListener) return;
    controls.addEventListener("change", updateLabels);
    return () => controls.removeEventListener("change", updateLabels);
  }, [updateLabels]);

  // When the focus set changes, re-apply label visibility immediately.
  useEffect(() => {
    focusRef.current = focusIds;
    updateLabels();
  }, [focusIds, updateLabels]);

  // Reset view: smoothly re-frame the whole graph.
  useEffect(() => {
    if (fitSignal > 0) fgRef.current?.zoomToFit?.(800);
  }, [fitSignal]);

  // Focus mode: hide nodes (and links) outside the selected node's neighborhood.
  const nodeVisibility = useCallback(
    (node: any) => !focusIds || focusIds.has((node as GraphNode).id),
    [focusIds]
  );

  const linkVisibility = useCallback(
    (link: any) => {
      if (!focusIds) return true;
      const s = link.source;
      const t = link.target;
      const sid = typeof s === "string" ? s : s?.id;
      const tid = typeof t === "string" ? t : t?.id;
      return focusIds.has(sid) && focusIds.has(tid);
    },
    [focusIds]
  );

  const handleHover = useCallback(
    (node: any) => {
      onNodeHover((node as GraphNode | null) || null);
      document.body.style.cursor = node ? "pointer" : "default";
    },
    [onNodeHover]
  );

  // Clicking a node flies the camera in to frame it, then selects it.
  const handleClick = useCallback(
    (node: any) => {
      const fg = fgRef.current;
      if (fg && node) {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const z = node.z ?? 0;
        const dist = Math.hypot(x, y, z) || 1;
        const ratio = 1 + FOCUS_CAMERA_DISTANCE / dist;
        fg.cameraPosition(
          { x: x * ratio, y: y * ratio, z: z * ratio },
          { x, y, z },
          900
        );
      }
      onNodeClick(node as GraphNode);
    },
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
        nodeVisibility={nodeVisibility}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        onEngineStop={handleEngineStop}
        linkColor={() => "rgba(180, 168, 148, 0.35)"}
        linkWidth={0.5}
        linkOpacity={0.4}
        linkVisibility={linkVisibility}
        onNodeHover={handleHover}
        onNodeClick={handleClick}
        onBackgroundClick={onBackgroundClick}
        enableNodeDrag={false}
        showNavInfo={false}
        backgroundColor="rgba(0,0,0,0)"
      />
    </div>
  );
}
