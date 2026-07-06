"use client";

// This module is only ever loaded client-side (the parent imports it via
// next/dynamic with ssr:false), so a static import of the WebGL graph + three
// is safe and keeps the heavy 3D bundle out of the initial page load.
import { useCallback, useEffect, useMemo, useRef } from "react";
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
// Cap on simultaneously revealed non-hub labels — without it, flying inside the
// cloud puts every node within reveal distance and the view becomes a text wall.
const MAX_REVEALED_LABELS = 24;
// Hub labels anchor the zoomed-out map, so they render larger than the rest.
const LABEL_HEIGHT = 5;
const HUB_LABEL_HEIGHT = 8.5;
// How far the camera sits from a node when you click to focus it.
const FOCUS_CAMERA_DISTANCE = 150;

function makeNodeMesh(n: GraphNode, hit: boolean): THREE.Mesh {
  const base = getNodeSize(n);
  const color = hit ? SEARCH_HIT_COLOR : getNodeColor(n);
  // Distinct silhouette per type: rounded gem = concept, smooth orb = idea,
  // crisp diamond (octahedron) = essay. Higher subdivision reads as polished,
  // not low-poly.
  let geometry: THREE.BufferGeometry;
  if (n.type === "concept") {
    geometry = new THREE.IcosahedronGeometry(base * 1.15, 1);
  } else if (n.type === "writing") {
    geometry = new THREE.OctahedronGeometry(base * 1.4, 0);
  } else {
    geometry = new THREE.SphereGeometry(base * 0.95, 32, 32);
  }
  // Physical material with a soft clearcoat sheen + faint inner glow — a sleek,
  // modern finish rather than a flat/neon look.
  const material = new THREE.MeshPhysicalMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: hit ? 0.5 : 0.2,
    roughness: 0.3,
    metalness: 0.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.35,
  });
  return new THREE.Mesh(geometry, material);
}

function makeLabel(n: GraphNode, isHub: boolean): SpriteText {
  const text = n.title.length > 30 ? `${n.title.slice(0, 30)}…` : n.title;
  const label = new SpriteText(text);
  label.color = "rgba(250, 248, 245, 0.96)";
  label.backgroundColor = "rgba(26, 24, 18, 0.82)";
  label.padding = 2;
  label.borderRadius = 3;
  label.textHeight = isHub ? HUB_LABEL_HEIGHT : LABEL_HEIGHT;
  label.position.set(0, getNodeSize(n) * 1.6 + 3, 0);
  label.material.transparent = true;
  label.material.opacity = 0;
  label.visible = false; // revealed by distance / focus, see updateLabels()
  label.userData.isNodeLabel = true;
  label.userData.nodeId = n.id;
  label.userData.isHub = isHub;
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
  // Mirror focusIds into a ref so the controls-change handler reads the latest.
  const focusRef = useRef<Set<string> | null>(focusIds);
  // Camera pose captured when flying into a node, restored on deselect so the
  // user isn't left stranded inside the cloud.
  const savedCamRef = useRef<{
    pos: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null>(null);
  const query = searchQuery.trim().toLowerCase();

  const isSearchHit = useCallback(
    (node: GraphNode) => !!query && node.title.toLowerCase().includes(query),
    [query]
  );

  // Link counts are static per dataset, so the hubs are known up front — no
  // need to wait for the simulation. Exactly HUB_COUNT ids (ties broken by id):
  // a value threshold would promote every tied node and, since hubs bypass the
  // label cap, recreate the text wall the cap exists to prevent.
  const hubIds = useMemo(() => {
    const ranked = [...data.nodes].sort(
      (a, b) => (b.linkCount ?? 0) - (a.linkCount ?? 0) || a.id.localeCompare(b.id)
    );
    return new Set(ranked.slice(0, HUB_COUNT).map((n) => n.id));
  }, [data.nodes]);

  // Auto-fit once per dataset. The engine restarts (and re-stops) on unrelated
  // prop changes like container resizes — without this guard every re-stop
  // would yank the camera back to the overview.
  const didFitRef = useRef(false);
  useEffect(() => {
    didFitRef.current = false;
  }, [data]);

  // Every node is a custom group: a type-specific mesh plus its label.
  const nodeThreeObject = useCallback(
    (node: any) => {
      const n = node as GraphNode;
      const group = new THREE.Group();
      group.add(makeNodeMesh(n, isSearchHit(n)));
      group.add(makeLabel(n, hubIds.has(n.id)));
      return group;
    },
    [isSearchHit, hubIds]
  );

  // Label visibility: in focus mode show exactly the focused nodes' labels;
  // otherwise fade labels in as the camera approaches (nearest MAX_REVEALED_LABELS
  // only, so the view never becomes a text wall), and always show hubs.
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
    const candidates: Array<{ obj: any; d: number }> = [];
    scene.traverse((obj: any) => {
      if (!obj.userData?.isNodeLabel) return;
      if (focus) {
        const on = focus.has(obj.userData.nodeId);
        obj.visible = on;
        obj.material.opacity = on ? 1 : 0;
        return;
      }
      if (obj.userData.isHub) {
        obj.material.opacity = 1; // hubs anchor the map — always legible
        obj.visible = true;
        return;
      }
      obj.getWorldPosition(world);
      candidates.push({ obj, d: world.distanceTo(cam.position) });
    });
    if (focus) return;
    // The sort only matters when the cap can bite.
    if (candidates.length > MAX_REVEALED_LABELS) candidates.sort((a, b) => a.d - b.d);
    candidates.forEach(({ obj, d }, i) => {
      let opacity: number;
      if (i >= MAX_REVEALED_LABELS || d >= revealDist) opacity = 0;
      else if (d <= fullDist) opacity = 1;
      else opacity = (revealDist - d) / (revealDist - fullDist);
      obj.material.opacity = opacity;
      obj.visible = opacity > 0.04;
    });
  }, []);

  // Once the simulation settles: size the reveal distance to the actual graph
  // extent, clamp zoom so the camera can't get lost, and frame the whole graph
  // (the default camera sits far too deep, leaving the cloud tiny).
  const handleEngineStop = useCallback(() => {
    let radius = 0;
    for (const n of data.nodes as Array<GraphNode & { x?: number; y?: number; z?: number }>) {
      radius = Math.max(radius, Math.hypot(n.x ?? 0, n.y ?? 0, n.z ?? 0));
    }
    radiusRef.current = radius > 0 ? radius : 120;
    const controls = fgRef.current?.controls?.();
    const cam = fgRef.current?.camera?.();
    if (controls) {
      controls.minDistance = 10;
      // Never clamp below where the camera currently sits — the controls apply
      // maxDistance every frame and would visibly snap the camera inward
      // before the fit tween gets a chance to run.
      controls.maxDistance = Math.max(
        radiusRef.current * 5,
        600,
        cam ? cam.position.length() : 0
      );
    }
    // Skip the fit while a node is focused OR a focus fly-in just started
    // (savedCamRef is set synchronously on click, before focusIds updates).
    if (!focusRef.current && !savedCamRef.current && !didFitRef.current) {
      didFitRef.current = true;
      fgRef.current?.zoomToFit?.(700);
    }
    updateLabels();
  }, [data.nodes, updateLabels]);

  // Re-evaluate label visibility whenever the camera moves (zoom/rotate/pan).
  useEffect(() => {
    const controls = fgRef.current?.controls?.();
    if (!controls?.addEventListener) return;
    controls.addEventListener("change", updateLabels);
    return () => controls.removeEventListener("change", updateLabels);
  }, [updateLabels]);

  // Reset view: smoothly re-frame the whole graph. Declared BEFORE the
  // focus-restore effect: when Reset fires while a node is focused, both
  // effects run in the same commit, and this one must clear the saved pose
  // first so the restore below is skipped instead of fighting the fit tween.
  const prevFitSignalRef = useRef(fitSignal);
  useEffect(() => {
    if (fitSignal === prevFitSignalRef.current) return; // ignore remounts
    prevFitSignalRef.current = fitSignal;
    savedCamRef.current = null; // a full re-fit supersedes any saved pose
    fgRef.current?.zoomToFit?.(800);
  }, [fitSignal]);

  // When the focus set changes, re-apply label visibility immediately. On
  // deselect, fly the camera back to where it was before the focus fly-in.
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    focusRef.current = focusIds;
    if (focusIds) {
      // Re-entering focus mid-restore: keep the saved overview pose alive so
      // the next deselect still returns to the true overview.
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = null;
      }
    } else if (savedCamRef.current) {
      if (!didFitRef.current) {
        // The user clicked before the first auto-fit ever ran, so the saved
        // pose is the useless far-out default — fit the graph instead.
        savedCamRef.current = null;
        didFitRef.current = true;
        fgRef.current?.zoomToFit?.(800);
      } else {
        const { pos, target } = savedCamRef.current;
        fgRef.current?.cameraPosition(pos, target, 800);
        // Keep the pose until the tween lands: a click mid-restore must not
        // overwrite the real overview with a transient camera position.
        if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = setTimeout(() => {
          savedCamRef.current = null;
          restoreTimerRef.current = null;
        }, 850);
      }
    }
    updateLabels();
  }, [focusIds, updateLabels]);

  useEffect(
    () => () => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    },
    []
  );

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

  // Clicking a node flies the camera in to frame it, then selects it. The
  // pre-flight pose is saved (once per focus session) so deselect can restore it.
  const handleClick = useCallback(
    (node: any) => {
      const fg = fgRef.current;
      if (fg && node) {
        // Save the pose only when entering focus from a settled overview —
        // if savedCamRef is still set, a restore tween is in flight and the
        // current camera position is transient, not the real overview.
        if (!focusRef.current && !savedCamRef.current) {
          const cam = fg.camera?.();
          const target = fg.controls?.()?.target;
          if (cam && target) {
            savedCamRef.current = {
              pos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
              target: { x: target.x, y: target.y, z: target.z },
            };
          }
        }
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
    // Clear the hover state when the pointer leaves the canvas — force-graph
    // only reports hover-off while the pointer stays inside it.
    <div
      style={{ width: "100%", height: dimensions.height }}
      onPointerLeave={() => handleHover(null)}
    >
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
        // Stop the engine once the layout is effectively settled (instead of the
        // default 15s cooldown) so the auto-fit in onEngineStop fires promptly.
        d3AlphaMin={0.02}
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
