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
  type: "concept" | "idea" | "writing";
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

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
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

    const excerpt = content
      .replace(/^#.+$/m, "")
      .replace(/---[\s\S]*?---/, "")
      .trim()
      .slice(0, 120);

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

    const excerpt = content
      .replace(/^#.+$/m, "")
      .trim()
      .slice(0, 120);

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

    const excerpt = content
      .replace(/^#.+$/m, "")
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t, a) => a || t)
      .trim()
      .slice(0, 140);

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
