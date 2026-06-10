import { listFiles, getFilesContent } from "./github";
import { parseFrontmatter, extractTitle } from "./parser";
import { extractSection, firstParagraph } from "./markdown";

// A productive disagreement: a concept whose sources pull in different directions.
export interface Tension {
  concept: string;
  slug: string;
  url: string;
  definition: string;
  text: string;
  tags: string[];
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// Every concept with a substantive "## Tensions" section.
export async function getTensions(): Promise<Tension[]> {
  const paths = await listFiles("30 Concept");
  const files = await getFilesContent(paths);

  const out: Tension[] = [];
  for (const path of paths) {
    const file = files.get(path);
    if (!file) continue;

    const { frontmatter, content } = parseFrontmatter(file.content);
    const text = extractSection(content, "Tensions");
    if (text.length < 40) continue; // skip empty / placeholder

    const filename = path.split("/").pop()?.replace(/\.md$/, "") || "";
    const slug = slugify(filename);
    out.push({
      concept: extractTitle(content, path),
      slug,
      url: `/concepts/${slug}`,
      definition: firstParagraph(content),
      text,
      tags: Array.isArray(frontmatter.tags)
        ? (frontmatter.tags as string[])
        : [],
    });
  }
  return out;
}
