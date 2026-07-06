import { listFiles, getFilesContent } from "./github";
import { parseFrontmatter, extractTitle } from "./parser";

export interface GraphNode {
  id: string;
  title: string;
  tags: string[];
  excerpt: string;
  folder: string;
  linkCount: number;
  isOrphan: boolean;
  color: string;
  slug: string;
  // Sources (books/podcasts/articles) are synthetic hub nodes derived from the
  // ideas' `source:` frontmatter — they have no page of their own.
  type: "concept" | "idea" | "writing" | "source";
  // Published essays link out to the blog instead of an internal page.
  url?: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    totalNotes: number;
    totalLinks: number;
    orphanCount: number;
    tagCounts: Record<string, number>;
  };
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

// ---- Rendering helpers (shared by the 2D and 3D graph renderers) ----

// Warm palette matching the Ink & Parchment theme.
export const TAG_COLORS: Record<string, string> = {
  negotiation: "#c47a5a",
  hiring: "#7b9eb8",
  decision: "#9b7eb8",
  organization: "#7ba87e",
  competence: "#c4a05a",
  leadership: "#b87a7a",
  productivity: "#8ba87b",
  default: "#a09080",
};

export const CONCEPT_COLOR = "#8b6914"; // gold — synthesized concepts
export const IDEA_COLOR = "#a09080"; // tan — atomic ideas
export const WRITING_COLOR = "#b5603f"; // clay — published essays (diamonds/octahedra)
export const SOURCE_COLOR = "#4e6a8a"; // ink blue — books/podcasts (squares/cubes)
export const SEARCH_HIT_COLOR = "#c49a2e"; // golden highlight for search matches

export function getNodeColor(node: GraphNode): string {
  // Essays and sources each read as one category regardless of tags.
  if (node.type === "writing") return WRITING_COLOR;
  if (node.type === "source") return SOURCE_COLOR;
  if (node.color) return node.color;
  for (const tag of node.tags) {
    const normalized = tag.toLowerCase().replace(/\s+/g, "");
    if (TAG_COLORS[normalized]) return TAG_COLORS[normalized];
  }
  return node.type === "concept" ? CONCEPT_COLOR : IDEA_COLOR;
}

// Node radius from connectivity — shared so 2D and 3D size nodes identically.
export function getNodeSize(node: GraphNode): number {
  return Math.max(4, 3 + Math.sqrt(node.linkCount + 1) * 1.8);
}

export interface FilteredGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

// react-force-graph mutates link endpoints from ids into node objects at runtime,
// so accept either shape.
function endpointId(end: string | GraphNode): string {
  return typeof end === "string" ? end : end.id;
}

// Drop orphans, then (when searching) keep title/tag matches plus their 1-hop
// neighbors, pruning links to those between visible nodes. Pure — returns new
// arrays, never mutates the input.
export function filterGraph(data: GraphData, query: string): FilteredGraph {
  let nodes = data.nodes.filter((n) => !n.isOrphan);
  const q = query.trim().toLowerCase();

  if (q) {
    const matchedIds = new Set(
      nodes
        .filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q))
        )
        .map((n) => n.id)
    );

    for (const link of data.links) {
      const sourceId = endpointId(link.source);
      const targetId = endpointId(link.target);
      if (matchedIds.has(sourceId)) matchedIds.add(targetId);
      if (matchedIds.has(targetId)) matchedIds.add(sourceId);
    }

    nodes = nodes.filter((n) => matchedIds.has(n.id));
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const links = data.links.filter((link) => {
    const sourceId = endpointId(link.source);
    const targetId = endpointId(link.target);
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });

  return { nodes, links };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// "[[The Obstacle Is the Way - Holiday]]" -> "The Obstacle Is the Way - Holiday".
// Tolerates path prefixes, aliases, and heading/block fragments.
function wikilinkTarget(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const match = raw.match(/\[\[([^\]|#]+)/);
  if (!match) return "";
  return (match[1].split("/").pop() || match[1]).trim();
}

// Vault source files are named "{Title} - {Author}"; drop the trailing author
// segment for display. Titles containing " - " survive (only the last segment
// goes), and files without the suffix pass through unchanged.
function sourceDisplayTitle(filename: string): string {
  const cut = filename.lastIndexOf(" - ");
  return cut > 0 ? filename.slice(0, cut).trim() : filename;
}

// Plain-text excerpt for hover/detail cards: strip heading lines (idea files
// start sections with "## Insight" etc.), blockquote markers, link syntax,
// inline markdown marks, and collapse whitespace.
function makeExcerpt(content: string, maxLen: number): string {
  return content
    // Defensive: parseFrontmatter's malformed-YAML fallback can leave the
    // frontmatter block in place. Anchored so body `---` dividers survive.
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .replace(/^#{1,6}\s.*$/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t, a) => a || t)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export async function buildGraphData(): Promise<GraphData> {
  // List files (uses tree API — 1 call)
  const [conceptPaths, ideaPaths, writingPaths] = await Promise.all([
    listFiles("30 Concept", "force-cache"),
    listFiles("20 Ideas", "force-cache"),
    listFiles("40 Write/49 Publish", "force-cache"),
  ]);

  // Fetch all content in parallel
  const allPaths = [...conceptPaths, ...ideaPaths, ...writingPaths];
  const files = await getFilesContent(allPaths, "force-cache");

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const tagCounts: Record<string, number> = {};
  const fileIndex = new Map<string, string>(); // filename -> node id

  // Single pass: parse content, build nodes, extract links
  for (const path of conceptPaths) {
    const file = files.get(path);
    if (!file) continue;

    const { frontmatter, content } = parseFrontmatter(file.content);
    const title = extractTitle(content, path);
    const filename = path.split("/").pop()?.replace(".md", "") || "";
    const id = `concept:${slugify(filename)}`;
    const slug = slugify(filename);

    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }

    const excerpt = makeExcerpt(content, 120);

    nodes.push({
      id,
      title,
      tags,
      excerpt,
      folder: "Concepts",
      linkCount: 0,
      isOrphan: true,
      color: "",
      slug,
      type: "concept",
    });

    fileIndex.set(filename.toLowerCase(), id);
  }

  for (const path of ideaPaths) {
    const file = files.get(path);
    if (!file) continue;

    const { frontmatter, content } = parseFrontmatter(file.content);
    if (frontmatter.review_status !== "reviewed") continue;

    const title = extractTitle(content, path);
    const filename = path.split("/").pop()?.replace(".md", "") || "";
    const id = `idea:${slugify(filename)}`;
    const slug = slugify(filename);

    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }

    const excerpt = makeExcerpt(content, 120);

    nodes.push({
      id,
      title,
      tags,
      excerpt,
      folder: "Ideas",
      linkCount: 0,
      isOrphan: true,
      color: "",
      slug,
      type: "idea",
    });

    fileIndex.set(filename.toLowerCase(), id);

    // Every idea's `source:` frontmatter names the book/podcast it came from.
    // Materialize that file as a synthetic hub node (once per source) and
    // register it in the file index — the wikilink pass below then turns the
    // frontmatter link of every idea into an idea→source edge for free. The
    // `![[...#^ref]]` body embeds don't collide: their lookup keys carry the
    // block fragment, so they never resolve to the plain filename.
    const sourceFile = wikilinkTarget(frontmatter.source);
    if (sourceFile && !fileIndex.has(sourceFile.toLowerCase())) {
      const sourceType =
        typeof frontmatter.source_type === "string" && frontmatter.source_type
          ? frontmatter.source_type
          : "source";
      nodes.push({
        id: `source:${slugify(sourceFile)}`,
        title: sourceDisplayTitle(sourceFile),
        tags: [sourceType],
        excerpt: "", // filled in after link counts are known
        folder: "Sources",
        linkCount: 0,
        isOrphan: true,
        color: "",
        slug: slugify(sourceFile),
        type: "source",
      });
      fileIndex.set(sourceFile.toLowerCase(), `source:${slugify(sourceFile)}`);
    }
  }

  // Published essays — the output side of the loop. They cite concepts via
  // wikilinks, so the graph connects writing back to the knowledge it draws on.
  for (const path of writingPaths) {
    const file = files.get(path);
    if (!file) continue;

    const { frontmatter, content } = parseFrontmatter(file.content);
    // Only the published essays carry a blog url / publish date; skip WIP drafts.
    const url = typeof frontmatter.url === "string" ? frontmatter.url : undefined;
    if (!url && !frontmatter.date_published) continue;

    const filename = path.split("/").pop()?.replace(".md", "") || "";
    const title =
      typeof frontmatter.title === "string" && frontmatter.title
        ? frontmatter.title
        : extractTitle(content, path);
    const slug = slugify(filename);
    const id = `writing:${slug}`;

    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }

    const excerpt = makeExcerpt(content, 140);

    nodes.push({
      id,
      title,
      tags,
      excerpt,
      folder: "Writing",
      linkCount: 0,
      isOrphan: true,
      color: "",
      slug,
      type: "writing",
      url,
    });

    fileIndex.set(filename.toLowerCase(), id);
  }

  // Extract wikilinks from already-fetched content (no re-fetching)
  for (const path of allPaths) {
    const file = files.get(path);
    if (!file) continue;

    const filename = path.split("/").pop()?.replace(".md", "") || "";
    const sourceId = fileIndex.get(filename.toLowerCase());
    if (!sourceId) continue;

    WIKILINK_RE.lastIndex = 0;
    let match;
    while ((match = WIKILINK_RE.exec(file.content)) !== null) {
      const linkTarget = match[1].split("/").pop() || match[1];
      const targetId = fileIndex.get(linkTarget.toLowerCase());
      if (targetId && targetId !== sourceId) {
        links.push({ source: sourceId, target: targetId });
      }
    }
  }

  // Update link counts and orphan status
  const linkCountMap = new Map<string, number>();
  for (const link of links) {
    linkCountMap.set(link.source, (linkCountMap.get(link.source) || 0) + 1);
    linkCountMap.set(link.target, (linkCountMap.get(link.target) || 0) + 1);
  }

  for (const node of nodes) {
    node.linkCount = linkCountMap.get(node.id) || 0;
    node.isOrphan = node.linkCount === 0;
    if (node.type === "source") {
      node.excerpt = `${node.tags[0] ?? "source"} · ${node.linkCount} extracted idea${
        node.linkCount === 1 ? "" : "s"
      } in the graph`;
    }
  }

  const orphanCount = nodes.filter((n) => n.isOrphan).length;

  return {
    nodes,
    links,
    stats: {
      totalNotes: nodes.length,
      totalLinks: links.length,
      orphanCount,
      tagCounts,
    },
  };
}
