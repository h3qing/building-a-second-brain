import { listFiles, getFilesContent } from "./github";
import { parseFrontmatter, extractTitle } from "./parser";
import { extractSection, firstParagraph } from "./markdown";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const READY_THRESHOLD = 3;

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

interface ConceptMeta {
  title: string;
  slug: string;
  definition: string;
  tensions: string;
  tags: string[];
}

export interface IdeaRef {
  title: string;
  slug: string;
  url: string;
  insight: string;
  source: string | null;
  quote: string;
}

export interface WritableConcept {
  concept: string;
  slug: string;
  url: string; // /write/<slug>
  definition: string;
  ideaCount: number;
  tags: string[];
}

export interface WritingBrief {
  concept: string;
  slug: string;
  definition: string;
  tensions: string;
  ideaCount: number;
  ideas: IdeaRef[];
  prompt: string;
}

// Map each concept to the REVIEWED ideas that wikilink to it.
async function buildBacklinks(): Promise<{
  concepts: Map<string, ConceptMeta>;
  ideasByConcept: Map<string, IdeaRef[]>;
}> {
  const [conceptPaths, ideaPaths] = await Promise.all([
    listFiles("30 Concept"),
    listFiles("20 Ideas"),
  ]);
  const files = await getFilesContent([...conceptPaths, ...ideaPaths]);

  const concepts = new Map<string, ConceptMeta>();
  const slugByFilename = new Map<string, string>();
  for (const path of conceptPaths) {
    const file = files.get(path);
    if (!file) continue;
    const { frontmatter, content } = parseFrontmatter(file.content);
    const filename = path.split("/").pop()?.replace(/\.md$/, "") || "";
    const slug = slugify(filename);
    concepts.set(slug, {
      title: extractTitle(content, path),
      slug,
      definition: firstParagraph(content),
      tensions: extractSection(content, "Tensions"),
      tags: Array.isArray(frontmatter.tags)
        ? (frontmatter.tags as string[])
        : [],
    });
    slugByFilename.set(filename.toLowerCase(), slug);
  }

  const ideasByConcept = new Map<string, IdeaRef[]>();
  for (const path of ideaPaths) {
    const file = files.get(path);
    if (!file) continue;
    const { frontmatter, content } = parseFrontmatter(file.content);
    if (frontmatter.review_status !== "reviewed") continue;

    const filename = path.split("/").pop()?.replace(/\.md$/, "") || "";
    const ref: IdeaRef = {
      title: extractTitle(content, path),
      slug: slugify(filename),
      url: `/ideas/${slugify(filename)}`,
      insight: extractSection(content, "Insight"),
      source:
        typeof frontmatter.source === "string"
          ? frontmatter.source.replace(/\[\[|\]\]/g, "").split("/").pop() || null
          : null,
      quote:
        extractSection(content, "Source Context") ||
        extractSection(content, "Context"),
    };

    const seen = new Set<string>();
    WIKILINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKILINK_RE.exec(content)) !== null) {
      const target = (m[1].split("/").pop() || m[1]).trim().toLowerCase();
      const conceptSlug = slugByFilename.get(target);
      if (conceptSlug && !seen.has(conceptSlug)) {
        seen.add(conceptSlug);
        const arr = ideasByConcept.get(conceptSlug) || [];
        ideasByConcept.set(conceptSlug, [...arr, ref]);
      }
    }
  }

  return { concepts, ideasByConcept };
}

// Concepts you've reviewed enough material on to write about, richest first.
export async function getWritableConcepts(
  threshold = READY_THRESHOLD
): Promise<WritableConcept[]> {
  const { concepts, ideasByConcept } = await buildBacklinks();
  const out: WritableConcept[] = [];
  for (const [slug, meta] of concepts) {
    const ideas = ideasByConcept.get(slug) || [];
    if (ideas.length < threshold) continue;
    out.push({
      concept: meta.title,
      slug,
      url: `/write/${slug}`,
      definition: meta.definition,
      ideaCount: ideas.length,
      tags: meta.tags,
    });
  }
  return out.sort((a, b) => b.ideaCount - a.ideaCount);
}

// Everything you need to draft an essay on one concept.
export async function getWritingBrief(
  slug: string
): Promise<WritingBrief | null> {
  const { concepts, ideasByConcept } = await buildBacklinks();
  const meta = concepts.get(slug);
  if (!meta) return null;
  const ideas = ideasByConcept.get(slug) || [];
  const sources = [
    ...new Set(ideas.map((i) => i.source).filter((s): s is string => !!s)),
  ];

  return {
    concept: meta.title,
    slug,
    definition: meta.definition,
    tensions: meta.tensions,
    ideaCount: ideas.length,
    ideas,
    prompt: buildPrompt(meta, ideas.length, sources),
  };
}

function buildPrompt(
  meta: ConceptMeta,
  count: number,
  sources: string[]
): string {
  const src = sources.length
    ? ` drawing on ${count} ideas from ${sources.slice(0, 6).join(", ")}`
    : ` drawing on ${count} ideas`;
  const tension = meta.tensions
    ? ` Resolve the core tension: ${meta.tensions}`
    : "";
  return `Write an essay on "${meta.title}" in my voice,${src}.${tension} Take a clear position. Don't summarize.`;
}

export function renderBriefMarkdown(brief: WritingBrief): string {
  const lines: string[] = [`# Writing brief: ${brief.concept}`, ""];
  if (brief.definition) lines.push(`> ${brief.definition}`, "");
  if (brief.tensions) lines.push(`**Tension:** ${brief.tensions}`, "");
  lines.push(`**Prompt:** ${brief.prompt}`, "");
  lines.push(`## Material (${brief.ideaCount} reviewed ideas)`, "");
  for (const idea of brief.ideas) {
    lines.push(`### ${idea.title}${idea.source ? ` — ${idea.source}` : ""}`);
    if (idea.insight) lines.push(idea.insight);
    if (idea.quote) lines.push(`> ${idea.quote}`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}
