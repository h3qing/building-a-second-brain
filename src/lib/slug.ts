// One slug rule for every URL the app builds (concept/idea/write pages, graph
// node ids, recap links). Keep it the single copy: a page resolves a slug by
// recomputing it from the filename, so any drift between copies is a 404.
//
// Letters and digits in any script survive — an ASCII-only rule turned every
// Chinese filename into "", so all Chinese concepts collided on one URL and
// one graph node. ASCII names slug exactly as before.
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{M}\p{N}-]/gu, "");
  // A name made only of punctuation/emoji would still slug to "" — give it a
  // stable hash so it gets its own URL instead of colliding.
  return slug || `n-${hash(name)}`;
}

// FNV-1a, base36 — short and deterministic, not for security.
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// Route params for non-ASCII slugs can arrive percent-encoded. Slugs never
// contain "%", so decoding is safe whether or not the router already did.
export function decodeSlug(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

export const conceptHref = (slug: string) =>
  `/concepts/${encodeURIComponent(slug)}`;
export const ideaHref = (slug: string) => `/ideas/${encodeURIComponent(slug)}`;
export const writeHref = (slug: string) => `/write/${encodeURIComponent(slug)}`;
