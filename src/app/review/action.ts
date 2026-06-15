"use server";

import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { getFileContent, updateFile } from "@/lib/github";
import {
  updateReviewStatus,
  updateSpacedRepetition,
  updateStarStatus,
  replaceInsight,
  type Difficulty,
} from "@/lib/parser";
import { applyReviewToQueueCache } from "@/lib/review-queue";

export async function reviewAction(formData: FormData) {
  const isLoggedIn = await verifySession();
  if (!isLoggedIn) redirect("/login");

  const path = formData.get("path") as string;
  const action = formData.get("action") as string;
  const returnTo = formData.get("returnTo") as string;
  const sha = formData.get("sha") as string;
  const rawContent = formData.get("rawContent") as string;
  const customInsight = formData.get("customInsight") as string | null;
  const insightChanged = formData.get("insightChanged") === "true";

  if (!path || !action) redirect("/review");

  const today = new Date().toISOString().split("T")[0];

  const srActions: Difficulty[] = ["easy", "medium", "hard"];
  const isSR = srActions.includes(action as Difficulty);
  const isStar = action === "star" || action === "unstar";

  const validAction =
    isSR || isStar || action === "approve" || action === "contest";
  if (!validAction) {
    redirect(returnTo || "/review");
    return;
  }

  const slug = path.split("/").pop()?.replace(".md", "") || "unknown";

  // Apply custom insight to source before review status update. Star toggles
  // never carry an insight edit, so this stays a no-op for them.
  const applyInsight = (source: string): string =>
    insightChanged && customInsight
      ? replaceInsight(source, customInsight)
      : source;

  // Turn the current file contents into the committed version for this action.
  // Computed from whichever source we have (form-supplied or freshly read).
  const transform = (source: string): string => {
    const base = applyInsight(source);
    if (isSR) return updateSpacedRepetition(base, action as Difficulty, today);
    if (isStar) return updateStarStatus(base, action === "star");
    return updateReviewStatus(
      base,
      action === "approve" ? "reviewed" : "contested",
      today
    );
  };

  const message = `review: ${action} "${slug}"`;

  // Fast path with SHA from form
  if (sha) {
    const source = rawContent || (await getFileContent(path))?.content;
    if (!source) redirect("/review");
    const success = await updateFile(path, transform(source!), sha, message);

    if (!success) {
      // SHA was stale, re-read and retry once
      const freshFile = await getFileContent(path);
      if (freshFile) {
        await updateFile(path, transform(freshFile.content), freshFile.sha, message);
      }
    }
  } else {
    // Fallback: read from API
    const file = await getFileContent(path);
    if (!file) redirect("/review");
    await updateFile(path, transform(file!.content), file!.sha, message);
  }

  // Keep the in-memory queue cache in step with the commit so the next card
  // render reflects this review immediately (status, dates, session position).
  applyReviewToQueueCache(path, action, today);

  redirect(returnTo || "/review");
}
