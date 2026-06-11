"use server";

import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { getFileContent, updateFile } from "@/lib/github";
import {
  updateReviewStatus,
  updateSpacedRepetition,
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

  let updatedContent: string;
  const slug = path.split("/").pop()?.replace(".md", "") || "unknown";

  // Apply custom insight to source before review status update
  const applyInsight = (source: string): string =>
    insightChanged && customInsight
      ? replaceInsight(source, customInsight)
      : source;

  if (isSR) {
    const source = rawContent || (await getFileContent(path))?.content;
    if (!source) redirect("/review");
    updatedContent = updateSpacedRepetition(applyInsight(source!), action as Difficulty, today);
  } else if (action === "approve" || action === "contest") {
    const status = action === "approve" ? "reviewed" : "contested";
    const source = rawContent || (await getFileContent(path))?.content;
    if (!source) redirect("/review");
    updatedContent = updateReviewStatus(applyInsight(source!), status, today);
  } else {
    redirect(returnTo || "/review");
    return;
  }

  const message = `review: ${action} "${slug}"`;

  // Fast path with SHA from form
  if (sha) {
    const success = await updateFile(path, updatedContent!, sha, message);

    if (!success) {
      // SHA was stale, re-read and retry once
      const freshFile = await getFileContent(path);
      if (freshFile) {
        const base = applyInsight(freshFile.content);
        const freshSource = isSR
          ? updateSpacedRepetition(base, action as Difficulty, today)
          : updateReviewStatus(
              base,
              action === "approve" ? "reviewed" : "contested",
              today
            );
        await updateFile(path, freshSource, freshFile.sha, message);
      }
    }
  } else {
    // Fallback: read from API
    const file = await getFileContent(path);
    if (!file) redirect("/review");
    const base = applyInsight(file!.content);
    const freshContent = isSR
      ? updateSpacedRepetition(base, action as Difficulty, today)
      : updateReviewStatus(
          base,
          action === "approve" ? "reviewed" : "contested",
          today
        );
    await updateFile(path, freshContent, file!.sha, message);
  }

  // Keep the in-memory queue cache in step with the commit so the next card
  // render reflects this review immediately (status, dates, session position).
  applyReviewToQueueCache(path, action, today);

  redirect(returnTo || "/review");
}
