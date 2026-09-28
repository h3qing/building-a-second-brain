import { listFiles, getFilesContent } from "./github";
import { parseFrontmatter, extractTitle } from "./parser";
import { extractSection, firstParagraph } from "./markdown";
import { slugify, ideaHref, writeHref } from "./slug";
import { readNotes, MY_SIDE, MY_TAKE, type DatedNote } from "./notes";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const READY_THRESHOLD = 3;

interface ConceptMeta {
  title: string;
  slug: string;
  definition: string;
  tensions: string;
  tags: string[];
  sides: DatedNote[]; // your `## My Side` lines
}

export interface IdeaRef {
  title: string;
  slug: string;
  url: string;
  insight: string;
  source: string | null;
  quote: string;
  takes: string[]; // your `## My Take` lines — only in private briefs
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
  mySide: string; // your latest position on the tension — private briefs only
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
      sides: readNotes(content, MY_SIDE),
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
      url: ideaHref(slugify(filename)),
      insight: extractSection(content, "Insight"),
      source:
        typeof frontmatter.source === "string"
          ? frontmatter.source.replace(/\[\[|\]\]/g, "").split("/").pop() || null
          : null,
      quote:
        extractSection(content, "Source Context") ||
        extractSection(content, "Context"),
      takes: readNotes(content, MY_TAKE).map((n) =>
        n.date
          ? `${n.date}${n.label ? ` (${n.label})` : ""}: ${n.text}`
          : n.text
      ),
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
      url: writeHref(slug),
      definition: meta.definition,
      ideaCount: ideas.length,
      tags: meta.tags,
    });
  }
  return out.sort((a, b) => b.ideaCount - a.ideaCount);
}

// Everything you need to draft an essay on one concept. `includePrivate`
// (the signed-in owner, or the token-gated API) adds your own takes and
// position — the part of the material that's actually in your voice.
export async function getWritingBrief(
  slug: string,
  includePrivate = false
): Promise<WritingBrief | null> {
  const { concepts, ideasByConcept } = await buildBacklinks();
  const meta = concepts.get(slug);
  if (!meta) return null;
  const ideas = (ideasByConcept.get(slug) || []).map((i) =>
    includePrivate ? i : { ...i, takes: [] }
  );
  const mySide = includePrivate ? meta.sides.at(-1)?.text || "" : "";
  const sources = [
    ...new Set(ideas.map((i) => i.source).filter((s): s is string => !!s)),
  ];

  return {
    concept: meta.title,
    slug,
    definition: meta.definition,
    tensions: meta.tensions,
    mySide,
    ideaCount: ideas.length,
    ideas,
    prompt: buildPrompt(
      meta,
      ideas.length,
      sources,
      !!mySide || ideas.some((i) => i.takes.length > 0)
    ),
  };
}

function buildPrompt(
  meta: ConceptMeta,
  count: number,
  sources: string[],
  hasOwnNotes: boolean
): string {
  const src = sources.length
    ? ` drawing on ${count} ideas from ${sources.slice(0, 6).join(", ")}`
    : ` drawing on ${count} ideas`;
  const tension = meta.tensions
    ? ` Resolve the core tension: ${meta.tensions}`
    : "";
  const own = hasOwnNotes
    ? " Start from my own position and takes below; the sources are support or foil, not the argument."
    : "";
  return `Write an essay on "${meta.title}" in my voice,${src}.${tension}${own} Take a clear position. Don't summarize.`;
}

export function renderBriefMarkdown(brief: WritingBrief): string {
  const lines: string[] = [`# Writing brief: ${brief.concept}`, ""];
  if (brief.definition) lines.push(`> ${brief.definition}`, "");
  if (brief.tensions) lines.push(`**Tension:** ${brief.tensions}`, "");
  if (brief.mySide) lines.push(`**My side:** ${brief.mySide}`, "");
  lines.push(`**Prompt:** ${brief.prompt}`, "");
  lines.push(`## Material (${brief.ideaCount} reviewed ideas)`, "");
  for (const idea of brief.ideas) {
    lines.push(`### ${idea.title}${idea.source ? ` — ${idea.source}` : ""}`);
    if (idea.insight) lines.push(idea.insight);
    if (idea.quote) lines.push(`> ${idea.quote}`);
    for (const take of idea.takes) lines.push(`- *My take* ${take}`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}
