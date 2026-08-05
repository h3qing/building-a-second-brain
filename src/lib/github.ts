const REPO_OWNER = process.env.GITHUB_REPO_OWNER || "h3qing";
const REPO_NAME = process.env.GITHUB_REPO_NAME || "obsidian";
const BRANCH = "main";

function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export interface RepoFile {
  path: string;
  sha: string;
  content: string;
}

export interface TreeEntry {
  path: string;
  sha: string;
  type: "blob" | "tree";
  size?: number;
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

// --- Git Trees API (1 call = all files) ---

let treeCache: { entries: TreeEntry[]; fetchedAt: number } | null = null;
const TREE_CACHE_TTL = 30_000; // 30s in-memory cache (within a warm lambda)
const TREE_REVALIDATE = 900; // 15min Next data cache (cross-request, enables ISR)
// Data-cache tag on the tree fetch. Writers must purge it (revalidateTag) so
// post-commit reads resolve fresh blob shas — github.ts can't do that itself
// because next/cache is server-only and this module also feeds client bundles
// (graph.ts re-exports rendering helpers). reviewAction handles it.
export const TREE_TAG = "repo-tree";

export async function getRepoTree(): Promise<TreeEntry[]> {
  const now = Date.now();
  if (treeCache && now - treeCache.fetchedAt < TREE_CACHE_TTL) {
    return treeCache.entries;
  }

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`;
  // Cache at the Next data layer so pages that list files stay statically
  // renderable (ISR). A hardcoded "no-store" here forces every consuming route
  // to render dynamically, defeating page-level `revalidate`.
  const res = await fetch(url, {
    headers: headers(),
    next: { revalidate: TREE_REVALIDATE, tags: [TREE_TAG] },
  });
  if (!res.ok) return treeCache?.entries || [];

  const data = await res.json();
  const entries: TreeEntry[] = (data.tree || [])
    .filter((item: { type: string }) => item.type === "blob")
    .map((item: { path: string; sha: string; type: string; size?: number }) => ({
      path: item.path,
      sha: item.sha,
      type: item.type,
      size: item.size,
    }));

  treeCache = { entries, fetchedAt: now };
  return entries;
}

// List files in a directory using the tree (no recursive API calls)
export async function listFiles(
  dirPath: string,
  cache: RequestCache = "no-store"
): Promise<string[]> {
  // Use tree API for fast listing
  const tree = await getRepoTree();
  const prefix = dirPath.endsWith("/") ? dirPath : dirPath + "/";
  return tree
    .filter((e) => e.path.startsWith(prefix) && e.path.endsWith(".md"))
    .map((e) => e.path);
}

// --- Content fetching ---

// Fresh Contents-API read, for read-modify-write flows only (review actions
// need the current sha for optimistic locking). Every display read should go
// through getFileViaTree / getFilesContent instead — those are content-
// addressed and only hit GitHub when a file actually changed.
export async function getFileContent(path: string): Promise<RepoFile | null> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}?ref=${BRANCH}`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { path: data.path, sha: data.sha, content };
}

// Content-addressed blob read. A blob's sha is immutable, so the response is
// safe to cache forever at the Next data layer — an unchanged file never
// refetches, and an edited file gets a new sha (hence a new cache key) as soon
// as the tree refreshes.
async function getBlobContent(
  path: string,
  sha: string
): Promise<RepoFile | null> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs/${sha}`;
  const res = await fetch(url, { headers: headers(), cache: "force-cache" });
  if (!res.ok) return null;
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { path, sha, content };
}

// Single-file read via tree-sha resolution: edits surface within
// TREE_REVALIDATE (or immediately after an in-app write, which purges the
// tree tag) without ever serving an indefinitely stale body.
export async function getFileViaTree(path: string): Promise<RepoFile | null> {
  const tree = await getRepoTree();
  const entry = tree.find((e) => e.path === path);
  if (!entry) return null;
  return getBlobContent(path, entry.sha);
}

// Fetch multiple files in parallel (batched to avoid rate limits). Resolves
// path -> sha from the tree, then reads immutable blobs — so a folder scan
// costs 1 tree call plus one blob call per *changed* file.
const PARALLEL_BATCH_SIZE = 20;

export async function getFilesContent(
  paths: string[]
): Promise<Map<string, RepoFile>> {
  const tree = await getRepoTree();
  const shaByPath = new Map(tree.map((e) => [e.path, e.sha]));
  const results = new Map<string, RepoFile>();

  for (let i = 0; i < paths.length; i += PARALLEL_BATCH_SIZE) {
    const batch = paths.slice(i, i + PARALLEL_BATCH_SIZE);
    const files = await Promise.all(
      batch.map((path) => {
        const sha = shaByPath.get(path);
        return sha ? getBlobContent(path, sha) : Promise.resolve(null);
      })
    );
    for (const file of files) {
      if (file) results.set(file.path, file);
    }
  }

  return results;
}

// --- Commit history ---

export interface CommitSummary {
  message: string;
  date: string; // ISO timestamp from author.date
}

let commitCache: { commits: CommitSummary[]; fetchedAt: number } | null = null;
const COMMIT_CACHE_TTL = 5 * 60_000; // 5 min

// Fetch recent commits, paginating up to `maxPages` * 100 items.
export async function listCommits(maxPages = 5): Promise<CommitSummary[]> {
  const now = Date.now();
  if (commitCache && now - commitCache.fetchedAt < COMMIT_CACHE_TTL) {
    return commitCache.commits;
  }

  const all: CommitSummary[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?sha=${BRANCH}&per_page=100&page=${page}`;
    const res = await fetch(url, { headers: headers(), cache: "no-store" });
    if (!res.ok) break;
    const data = (await res.json()) as Array<{
      commit: { message: string; author: { date: string } };
    }>;
    if (data.length === 0) break;
    for (const item of data) {
      all.push({
        message: item.commit.message,
        date: item.commit.author.date,
      });
    }
    if (data.length < 100) break;
  }

  commitCache = { commits: all, fetchedAt: now };
  return all;
}

// --- Write operations ---

export async function updateFile(
  path: string,
  newContent: string,
  sha: string,
  message: string
): Promise<boolean> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      message,
      content: Buffer.from(newContent).toString("base64"),
      sha,
      branch: BRANCH,
    }),
  });

  // Invalidate the in-memory tree cache on write. Callers (server actions)
  // must also revalidateTag(TREE_TAG) to purge the cross-request data cache.
  if (res.ok) treeCache = null;

  return res.ok;
}
