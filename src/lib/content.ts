import { listFiles, getFileContent, getFilesContent } from "./github";
import { parseFrontmatter, extractTitle } from "./parser";
import { remark } from "remark";
import remarkHtml from "remark-html";
import remarkGfm from "remark-gfm";

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export interface FileEntry {
  path: string;
  filename: string;
  slug: string;
}

// Build a file index for wikilink resolution (uses tree API — fast)
export async function buildFileIndex(): Promise<Map<string, FileEntry>> {
  const [conceptPaths, ideaPaths] = await Promise.all([
    listFiles("30 Concept", "force-cache"),
    listFiles("20 Ideas", "force-cache"),
  ]);

  const index = new Map<string, FileEntry>();

  for (const path of conceptPaths) {
    const filename = path.split("/").pop()?.replace(".md", "") || "";
    const slug = slugify(filename);
    index.set(filename.toLowerCase(), { path, filename, slug });
  }

  for (const path of ideaPaths) {
    const filename = path.split("/").pop()?.replace(".md", "") || "";
    const slug = slugify(filename);
    // Concepts take priority in disambiguation
    if (!index.has(filename.toLowerCase())) {
      index.set(filename.toLowerCase(), { path, filename, slug });
    }
  }

  return index;
}

// Resolve wikilinks in markdown to HTML links
function resolveWikilinks(
  markdown: string,
  fileIndex: Map<string, FileEntry>
): string {
  return markdown.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target, alias) => {
      const display = alias || target;
      const lookupName = (target.split("/").pop() || target).trim();
      const entry = fileIndex.get(lookupName.toLowerCase());

      if (!entry) return display;

      if (entry.path.startsWith("30 Concept/")) {
        return `<a href="/concepts/${entry.slug}" class="wikilink">${display}</a>`;
      }
      if (entry.path.startsWith("20 Ideas/")) {
        return `<a href="/ideas/${entry.slug}" class="wikilink">${display}</a>`;
      }

      return display;
    }
  );
}

// Drop the note's leading "# Title" — the page renders the title separately,
// so keeping it in the body shows the title twice. Only the first top-level
// heading is removed; "## " section headings are untouched.
function stripLeadingH1(content: string): string {
  return content.replace(/^\s*#\s+.*(?:\n|$)/, "");
}

// Render markdown to HTML with wikilink resolution
export async function renderMarkdown(
  content: string,
  fileIndex: Map<string, FileEntry>
): Promise<string> {
  const withLinks = resolveWikilinks(stripLeadingH1(content), fileIndex);
  const result = await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(withLinks);
  return result.toString();
}

// Find a concept file by slug (direct path construction, no scanning)
export async function findConceptBySlug(slug: string): Promise<{
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  title: string;
  bodyHtml: string;
} | null> {
  const fileIndex = await buildFileIndex();

  // Direct lookup: find entry matching slug in concepts
  for (const entry of fileIndex.values()) {
    if (entry.slug === slug && entry.path.startsWith("30 Concept/")) {
      const file = await getFileContent(entry.path, "force-cache");
      if (!file) return null;

      const { frontmatter, content } = parseFrontmatter(file.content);
      const title = extractTitle(content, entry.path);
      const bodyHtml = await renderMarkdown(content, fileIndex);

      return { path: entry.path, content, frontmatter, title, bodyHtml };
    }
  }

  return null;
}

// Find an idea file by slug (direct lookup, no scanning)
export async function findIdeaBySlug(slug: string): Promise<{
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  title: string;
  bodyHtml: string;
} | null> {
  const fileIndex = await buildFileIndex();

  for (const entry of fileIndex.values()) {
    if (entry.slug === slug && entry.path.startsWith("20 Ideas/")) {
      const file = await getFileContent(entry.path, "force-cache");
      if (!file) return null;

      const { frontmatter, content } = parseFrontmatter(file.content);
      if (frontmatter.review_status !== "reviewed") return null;

      const title = extractTitle(content, entry.path);
      const bodyHtml = await renderMarkdown(content, fileIndex);

      return { path: entry.path, content, frontmatter, title, bodyHtml };
    }
  }

  return null;
}

// Parse log.md into pipeline feed entries. Each entry is a section header of the
// form "## [YYYY-MM-DD] <action> | <title>", newest first.
export async function parsePipelineFeed(): Promise<
  Array<{
    date: string;
    text: string;
    tags: string[];
  }>
> {
  const file = await getFileContent("00 Meta/log.md", "force-cache");
  if (!file) return [];

  const entries: Array<{ date: string; text: string; tags: string[] }> = [];
  const headerRe = /^##\s*\[(\d{4}-\d{2}-\d{2})\]\s*(.+?)\s*$/gm;
  let match;
  while ((match = headerRe.exec(file.content)) !== null) {
    const date = match[1];
    const heading = match[2];
    const lower = heading.toLowerCase();

    const tags: string[] = [];
    if (lower.includes("ingest")) tags.push("ingested");
    if (lower.includes("extract")) tags.push("extracted");
    if (lower.includes("synth")) tags.push("synthesized");
    if (lower.includes("review")) tags.push("reviewed");
    if (lower.includes("concept")) tags.push("new concept");

    // Drop the leading "<action> | " so the title reads cleanly.
    const text = heading.replace(/^[\w-]+\s*\|\s*/, "");

    entries.push({ date, text, tags });
  }

  // log.md is newest-first, so the first matches are the most recent.
  return entries.slice(0, 20);
}
