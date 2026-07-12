"use client";

// This module is only ever loaded client-side (the parent imports it via
// next/dynamic with ssr:false), so a static import of the WebGL graph + three
// is safe and keeps the heavy 3D bundle out of the initial page load.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  getNodeColor,
  getNodeSize,
  DUE_COLOR,
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

// Emissive/bloom tuning per theme. In dark mode a low threshold lets every
// node glow softly (the cinematic look); in light mode the parchment background
// sits near full luminance, so the threshold parks at 1.0 and only deliberately
// overdriven emissives (due / search hits) push past it and halo.
function themeParams(isDark: boolean) {
  // Tuned against the ~300-node overview: with the whole cloud in frame the
  // emissives stack, so resting glow stays low and the threshold high enough
  // that only due/search/hover nodes actually bloom.
  return isDark
    ? { bloomStrength: 0.32, bloomThreshold: 0.7, bloomRadius: 0.2, rest: 0.12, due: 0.5, hit: 1.1, hoverBoost: 0.6 }
    : { bloomStrength: 0.4, bloomThreshold: 1.0, bloomRadius: 0.2, rest: 0.1, due: 1.2, hit: 1.25, hoverBoost: 0.35 };
}

function makeNodeMesh(n: GraphNode): THREE.Mesh {
  const base = getNodeSize(n);
  const color = getNodeColor(n);
  // Distinct silhouette per type: rounded gem = concept, smooth orb = idea,
  // crisp diamond (octahedron) = essay, cube = source (a book on the shelf).
  // Higher subdivision reads as polished, not low-poly.
  let geometry: THREE.BufferGeometry;
  if (n.type === "concept") {
    geometry = new THREE.IcosahedronGeometry(base * 1.15, 1);
  } else if (n.type === "writing") {
    geometry = new THREE.OctahedronGeometry(base * 1.4, 0);
  } else if (n.type === "source") {
    geometry = new THREE.BoxGeometry(base * 1.5, base * 1.5, base * 1.5);
  } else {
    geometry = new THREE.SphereGeometry(base * 0.95, 32, 32);
  }
  // Physical material with a soft clearcoat sheen + faint inner glow — the
  // scene environment map (set up once below) gives the clearcoat something
  // to reflect. Search/due/theme states are applied by mutation afterwards,
  // so the mesh itself is created exactly once per node per dataset.
  const material = new THREE.MeshPhysicalMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.2,
    roughness: 0.3,
    metalness: 0.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.35,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.nodeId = n.id;
  mesh.userData.restingIntensity = 0.2;
  return mesh;
}

function makeLabel(n: GraphNode): SpriteText {
  const text = n.title.length > 30 ? `${n.title.slice(0, 30)}…` : n.title;
  const label = new SpriteText(text);
  label.color = "rgba(250, 248, 245, 0.96)";
  label.backgroundColor = "rgba(26, 24, 18, 0.82)";
  label.padding = 2;
  label.borderRadius = 3;
  label.textHeight = LABEL_HEIGHT; // hubs get resized dynamically in updateLabels
  label.position.set(0, getNodeSize(n) * 1.6 + 3, 0);
  label.material.transparent = true;
  label.material.opacity = 0;
  label.visible = false; // revealed by distance / focus, see updateLabels()
  label.userData.isNodeLabel = true;
  label.userData.nodeId = n.id;
  label.renderOrder = 10;
  return label;
}

// Read a CSS custom property off the document root (theme-resolved).
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
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
  // Every node's mesh, keyed by id — search/due/hover/theme changes mutate
  // materials here instead of rebuilding the whole scene.
  const meshMapRef = useRef(new Map<string, THREE.Mesh>());
  const hoveredMeshRef = useRef<THREE.Mesh | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const query = searchQuery.trim().toLowerCase();

  // This component only mounts client-side (dynamic ssr:false), so matchMedia
  // is available from the first render.
  const [isDark, setIsDark] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  // Bloom needs an opaque canvas — match the surrounding card surface.
  const [bgColor, setBgColor] = useState("#171717");
  useEffect(() => {
    setBgColor(cssVar("--card", isDark ? "#171717" : "#fafafa"));
  }, [isDark]);

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
  const hubIdsRef = useRef(hubIds);
  useEffect(() => {
    hubIdsRef.current = hubIds;
  }, [hubIds]);

  // Auto-fit once per dataset. The engine restarts (and re-stops) on unrelated
  // prop changes like container resizes — without this guard every re-stop
  // would yank the camera back to the overview.
  const didFitRef = useRef(false);
  useEffect(() => {
    didFitRef.current = false;
  }, [data]);

  // Frame the bulk of the graph, not its outliers — a lone far-flung island
  // would otherwise dictate the camera distance and shrink the core cloud.
  const makeFitFilter = useCallback(() => {
    const pts = data.nodes.filter((n) =>
      Number.isFinite((n as any).x)
    ) as Array<GraphNode & { x: number; y: number; z: number }>;
    if (pts.length === 0) return () => true;
    const cx = pts.reduce((s, n) => s + n.x, 0) / pts.length;
    const cy = pts.reduce((s, n) => s + n.y, 0) / pts.length;
    const cz = pts.reduce((s, n) => s + (n.z ?? 0), 0) / pts.length;
    const rms = Math.sqrt(
      pts.reduce(
        (s, n) =>
          s + (n.x - cx) ** 2 + (n.y - cy) ** 2 + ((n.z ?? 0) - cz) ** 2,
        0
      ) / pts.length
    );
    const maxD = Math.max(rms * 2.5, 200);
    return (n: any) =>
      Number.isFinite(n.x) &&
      Math.hypot(n.x - cx, n.y - cy, (n.z ?? 0) - cz) <= maxD;
  }, [data.nodes]);

  // Stable identity: force-graph only rebuilds node objects when this callback
  // changes, so keeping it dependency-free means a search keystroke (or theme
  // flip) mutates existing materials instead of recreating ~300 meshes.
  const nodeThreeObject = useCallback((node: any) => {
    const n = node as GraphNode;
    const old = meshMapRef.current.get(n.id);
    if (old) {
      old.geometry.dispose();
      (old.material as THREE.Material).dispose();
    }
    const group = new THREE.Group();
    const mesh = makeNodeMesh(n);
    meshMapRef.current.set(n.id, mesh);
    group.add(mesh);
    group.add(makeLabel(n));
    return group;
  }, []);

  // Apply search-hit / due-for-review / theme state by mutating materials.
  useEffect(() => {
    const p = themeParams(isDark);
    for (const n of data.nodes) {
      const mesh = meshMapRef.current.get(n.id);
      if (!mesh) continue;
      const material = mesh.material as THREE.MeshPhysicalMaterial;
      const hit = isSearchHit(n);
      const baseColor = hit ? SEARCH_HIT_COLOR : getNodeColor(n);
      material.color.set(baseColor);
      // Due ideas glow amber so the bloom pass halos them in the cloud.
      const emissiveColor = hit
        ? SEARCH_HIT_COLOR
        : n.dueForReview
          ? DUE_COLOR
          : baseColor;
      const intensity = hit ? p.hit : n.dueForReview ? p.due : p.rest;
      material.emissive.set(emissiveColor);
      material.emissiveIntensity = intensity;
      mesh.userData.restingIntensity = intensity;
    }
  }, [data.nodes, isSearchHit, isDark]);

  // Dispose meshes for nodes that left the dataset (search filtering), and
  // everything on unmount — force-graph drops the objects from the scene but
  // never frees GPU resources for custom node objects.
  useEffect(() => {
    const ids = new Set(data.nodes.map((n) => n.id));
    for (const [id, mesh] of meshMapRef.current) {
      if (ids.has(id)) continue;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      meshMapRef.current.delete(id);
    }
  }, [data.nodes]);
  useEffect(
    () => () => {
      for (const [, mesh] of meshMapRef.current) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      meshMapRef.current.clear();
    },
    []
  );

  // One-time scene dressing, as soon as the graph instance exists: bloom pass
  // on the built-in composer, and a RoomEnvironment map so the clearcoat
  // materials have something to reflect.
  useEffect(() => {
    // Polls on setTimeout, NOT requestAnimationFrame — rAF freezes in hidden
    // tabs, and a background-loaded page would never get its scene dressed.
    let timer: ReturnType<typeof setTimeout> | null = null;
    let bloom: UnrealBloomPass | null = null;
    let output: OutputPass | null = null;
    let envTexture: THREE.Texture | null = null;
    let scene: THREE.Scene | null = null;
    let fgInstance: any = null;
    const setup = () => {
      const fg = fgRef.current;
      if (!fg) {
        timer = setTimeout(setup, 50);
        return;
      }
      fgInstance = fg;
      const p = themeParams(
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
      bloom = new UnrealBloomPass(
        new THREE.Vector2(dimensions.width, dimensions.height),
        p.bloomStrength,
        p.bloomRadius,
        p.bloomThreshold
      );
      fg.postProcessingComposer().addPass(bloom);
      // The composer renders in linear space; without a final OutputPass the
      // frame reaches the screen un-encoded and the dark background washes
      // out to gray.
      output = new OutputPass();
      fg.postProcessingComposer().addPass(output);
      bloomRef.current = bloom;

      const pmrem = new THREE.PMREMGenerator(fg.renderer());
      envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      scene = fg.scene();
      if (scene) {
        scene.environment = envTexture;
        // Opaque background via scene.background, NOT the backgroundColor
        // prop: the prop goes through renderer.setClearColor, which skips the
        // sRGB→linear conversion and comes out of the OutputPass washed-out
        // gray. THREE.Color converts properly.
        scene.background = new THREE.Color(
          cssVar(
            "--card",
            window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "#171717"
              : "#fafafa"
          )
        );
      }
    };
    setup();
    return () => {
      if (timer) clearTimeout(timer);
      if (scene) {
        scene.environment = null;
        scene.background = null;
      }
      envTexture?.dispose();
      const composer = fgInstance?.postProcessingComposer?.();
      if (output) {
        composer?.removePass?.(output);
        output.dispose();
      }
      if (bloom) {
        composer?.removePass?.(bloom);
        bloom.dispose();
      }
      bloomRef.current = null;
    };
    // dimensions are intentionally omitted: the composer propagates resizes to
    // its passes, so the bloom pass only needs its initial size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme flips retune bloom, background, and depth fog in place.
  useEffect(() => {
    const p = themeParams(isDark);
    const bloom = bloomRef.current;
    if (bloom) {
      bloom.strength = p.bloomStrength;
      bloom.threshold = p.bloomThreshold;
      bloom.radius = p.bloomRadius;
    }
    const scene = fgRef.current?.scene?.();
    if (scene?.background instanceof THREE.Color) scene.background.set(bgColor);
    if (scene?.fog) (scene.fog as THREE.FogExp2).color.set(bgColor);
  }, [isDark, bgColor]);

  // Label visibility: in focus mode show exactly the focused nodes' labels;
  // otherwise fade labels in as the camera approaches (nearest MAX_REVEALED_LABELS
  // only, so the view never becomes a text wall), and always show hubs.
  const updateLabelsNow = useCallback(() => {
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
      // Hub status tracks the current (filtered) dataset via the ref, so
      // reused sprites stay correct without any rebuild.
      const isHub = hubIdsRef.current.has(obj.userData.nodeId);
      const desiredHeight = isHub ? HUB_LABEL_HEIGHT : LABEL_HEIGHT;
      if (obj.textHeight !== desiredHeight) obj.textHeight = desiredHeight;
      if (isHub) {
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

  // The full pass above (scene.traverse + world-position math + sort) is too
  // heavy to run on every controls-change event, which fires once per frame
  // while rotating or zooming — that's where the interaction lag came from.
  // Trailing throttle at ~10Hz: cheap during motion, and the trailing call
  // still settles labels on the final camera pose.
  const labelThrottleRef = useRef<{
    last: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ last: 0, timer: null });
  const updateLabels = useCallback(() => {
    const t = labelThrottleRef.current;
    const wait = 100 - (performance.now() - t.last);
    if (wait <= 0) {
      t.last = performance.now();
      updateLabelsNow();
    } else if (!t.timer) {
      t.timer = setTimeout(() => {
        t.timer = null;
        t.last = performance.now();
        updateLabelsNow();
      }, wait);
    }
  }, [updateLabelsNow]);

  useEffect(
    () => () => {
      const t = labelThrottleRef.current;
      if (t.timer) clearTimeout(t.timer);
    },
    []
  );

  // Once the simulation settles: size the reveal distance to the actual graph
  // extent, clamp zoom so the camera can't get lost, tune the depth fog, and
  // frame the whole graph (the default camera sits far too deep, leaving the
  // cloud tiny).
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
    // Gentle exponential fog scaled to the cloud: distant nodes recede into
    // the background color instead of ending at a hard silhouette.
    const scene = fgRef.current?.scene?.();
    if (scene) {
      const density = 1 / (radiusRef.current * 5.5);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.density = density;
        scene.fog.color.set(bgColor);
      } else {
        scene.fog = new THREE.FogExp2(bgColor, density);
      }
    }
    // Skip the fit while a node is focused OR a focus fly-in just started
    // (savedCamRef is set synchronously on click, before focusIds updates).
    if (!focusRef.current && !savedCamRef.current && !didFitRef.current) {
      didFitRef.current = true;
      const before = fgRef.current?.camera?.()?.position.length() ?? 0;
      fgRef.current?.zoomToFit?.(700, 40, makeFitFilter());
      // A fit fired mid-init can silently no-op. If the camera hasn't moved
      // once the tween should have finished, fire it once more.
      setTimeout(() => {
        const cam = fgRef.current?.camera?.();
        if (
          cam &&
          Math.abs(cam.position.length() - before) < 1 &&
          !focusRef.current &&
          !savedCamRef.current
        ) {
          fgRef.current?.zoomToFit?.(700, 40, makeFitFilter());
        }
      }, 900);
    }
    updateLabelsNow(); // one-shot on settle — no need to throttle
  }, [data.nodes, bgColor, updateLabelsNow, makeFitFilter]);

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
    fgRef.current?.zoomToFit?.(800, 40, makeFitFilter());
  }, [fitSignal, makeFitFilter]);

  // When the focus set changes, frame the neighborhood and re-apply label
  // visibility. On deselect, fly the camera back to where it was before the
  // focus fly-in.
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
      // Frame the whole neighborhood. Unlike the old origin-relative fly-in,
      // zoomToFit can't strand the camera inside a node that sits far from
      // (or at) the origin.
      fgRef.current?.zoomToFit?.(900, 80, (n: any) => focusIds.has(n.id));
    } else if (savedCamRef.current) {
      if (!didFitRef.current) {
        // The user clicked before the first auto-fit ever ran, so the saved
        // pose is the useless far-out default — fit the graph instead.
        savedCamRef.current = null;
        didFitRef.current = true;
        fgRef.current?.zoomToFit?.(800, 40, makeFitFilter());
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
    updateLabelsNow(); // selection feedback must be immediate
  }, [focusIds, updateLabelsNow, makeFitFilter]);

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

  // Hover parity with 2D: the pointed-at node swells and brightens.
  const handleHover = useCallback(
    (node: any) => {
      const prev = hoveredMeshRef.current;
      if (prev) {
        prev.scale.setScalar(1);
        const m = prev.material as THREE.MeshPhysicalMaterial;
        m.emissiveIntensity = prev.userData.restingIntensity ?? 0.2;
        hoveredMeshRef.current = null;
      }
      if (node) {
        const mesh = meshMapRef.current.get((node as GraphNode).id);
        if (mesh) {
          mesh.scale.setScalar(1.2);
          const m = mesh.material as THREE.MeshPhysicalMaterial;
          m.emissiveIntensity =
            (mesh.userData.restingIntensity ?? 0.2) +
            themeParams(isDark).hoverBoost;
          hoveredMeshRef.current = mesh;
        }
      }
      onNodeHover((node as GraphNode | null) || null);
      document.body.style.cursor = node ? "pointer" : "default";
    },
    [onNodeHover, isDark]
  );

  // Clicking a node saves the overview pose (once per focus session) so
  // deselect can restore it; the actual fly-in happens in the focusIds effect,
  // which frames the whole neighborhood.
  const handleClick = useCallback(
    (node: any) => {
      const fg = fgRef.current;
      if (fg && node && !focusRef.current && !savedCamRef.current) {
        // Save the pose only when entering focus from a settled overview —
        // if savedCamRef is still set, a restore tween is in flight and the
        // current camera position is transient, not the real overview.
        const cam = fg.camera?.();
        const target = fg.controls?.()?.target;
        if (cam && target) {
          savedCamRef.current = {
            pos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
            target: { x: target.x, y: target.y, z: target.z },
          };
        }
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
        linkWidth={(link: any) => 0.5 + Math.min((link.weight ?? 1) - 1, 3) * 0.3}
        linkOpacity={0.4}
        linkVisibility={linkVisibility}
        onNodeHover={handleHover}
        onNodeClick={handleClick}
        onBackgroundClick={onBackgroundClick}
        enableNodeDrag={false}
        showNavInfo={false}
        // Transparent clear color; the real background is scene.background
        // (see the scene-dressing effect), which color-manages correctly
        // through the postprocessing chain.
        backgroundColor="rgba(0,0,0,0)"
      />
    </div>
  );
}
