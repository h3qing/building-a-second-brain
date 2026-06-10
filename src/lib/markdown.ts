// Small markdown helpers shared across features (tensions feed, writing briefs).

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, "");
}

// Body of a "## <heading>..." section, up to the next ## heading or end.
// Heading match is a prefix, so "Tensions" also matches "Tensions & Contradictions".
// Whitespace is collapsed; returns "" if absent or only a comment/placeholder.
export function extractSection(content: string, heading: string): string {
  const re = new RegExp(
    `(?:^|\\n)##\\s+${escapeRegExp(heading)}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    "i"
  );
  const m = content.match(re);
  if (!m) return "";
  return stripComments(m[1]).replace(/\s+/g, " ").trim();
}

// First prose paragraph (a concept's definition / lede). Skips headings and
// bare wikilink lines. Frontmatter is assumed already stripped.
export function firstParagraph(content: string): string {
  const buf: string[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || /^\[\[.*\]\]$/.test(line)) {
      if (buf.length) break;
      continue;
    }
    buf.push(line);
    if (buf.join(" ").length > 400) break;
  }
  return buf.join(" ").replace(/\s+/g, " ").trim();
}
