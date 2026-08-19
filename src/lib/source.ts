import { getRepoTree, getFileViaTree, RepoFile } from "./github";
import { parseFrontmatter } from "./parser";

// What the review card needs to render a prominent source block.
export interface SourceInfo {
  path: string | null;
  title: string;
  author: string;
  type: string; // book | podcast | article | video | conversation | course | personal
  url: string;
  coverUrl: string;
  sourceDate: string;
}

// Resolve an idea's `source` wikilink to its note under `10 Notes/`. Links come
// in two shapes: a full vault path (`[[10 Notes/Podcasts/Ep - Host]]`) or just
// the filename (`[[Atomic Habits - Clear]]`) — the latter needs a tree lookup.
export async function resolveSourceFile(
  frontmatter: Record<string, unknown>
): Promise<RepoFile | null> {
  if (typeof frontmatter.source !== "string") return null;
  const target = frontmatter.source
    .replace(/\[\[|\]\]/g, "")
    .split("|")[0]
    .trim()
    .replace(/\.md$/, "");
  if (!target) return null;

  if (target.startsWith("10 Notes/")) {
    return getFileViaTree(`${target}.md`).catch(() => null);
  }

  const tree = await getRepoTree();
  const entry = tree.find(
    (e) =>
      e.path.startsWith("10 Notes/") && e.path.endsWith(`/${target}.md`)
  );
  return entry ? getFileViaTree(entry.path).catch(() => null) : null;
}

// One icon/label per source type, shared by every surface that shows a source
// chip or card — so a video never renders as a book.
export const TYPE_META: Record<string, { icon: string; label: string }> = {
  book: { icon: "📖", label: "Book" },
  podcast: { icon: "🎙", label: "Podcast" },
  article: { icon: "📰", label: "Article" },
  video: { icon: "🎬", label: "Video" },
  conversation: { icon: "💬", label: "Conversation" },
  course: { icon: "🎓", label: "Course" },
  personal: { icon: "✍️", label: "Personal note" },
};

export function typeMeta(type: string) {
  return TYPE_META[type] || { icon: "📚", label: "Source" };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Folder-derived fallback: `20 Ideas/Books/Atomic Habits/idea.md` still knows
// its source title and type even when the wikilink doesn't resolve.
const FOLDER_TYPE: Record<string, string> = {
  Books: "book",
  Podcasts: "podcast",
  Articles: "article",
  Videos: "video",
  Conversations: "conversation",
  Courses: "course",
  Personal: "personal",
};

export async function getSourceInfo(
  frontmatter: Record<string, unknown>,
  ideaPath: string
): Promise<SourceInfo | null> {
  const parts = ideaPath.split("/");
  if (parts[0] !== "20 Ideas") return null; // concepts have no single source

  const file = await resolveSourceFile(frontmatter);
  const fallbackTitle = parts.length >= 4 ? parts[2] : "";
  const fallbackType = FOLDER_TYPE[parts[1]] || str(frontmatter.source_type);

  if (!file) {
    if (!fallbackTitle) return null;
    return {
      path: null,
      title: fallbackTitle,
      author: "",
      type: fallbackType,
      url: "",
      coverUrl: "",
      sourceDate: str(frontmatter.source_date),
    };
  }

  const fm = parseFrontmatter(file.content).frontmatter;
  // Kindle notes carry their metadata (incl. a cover image) in a nested block.
  const kindle = (fm["kindle-sync"] || {}) as Record<string, unknown>;

  return {
    path: file.path,
    title: str(kindle.title) || str(fm.title) || fallbackTitle,
    author: str(kindle.author) || str(fm.author),
    type: str(fm.source_type) || fallbackType || (kindle.title ? "book" : ""),
    url: str(fm.url),
    coverUrl: str(kindle.bookImageUrl),
    sourceDate: str(fm.source_date) || str(frontmatter.source_date),
  };
}
