"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { verifySession } from "@/lib/auth";
import { getFileContent, updateFile, TREE_TAG } from "@/lib/github";
import {
  updatePredictionOutcome,
  PREDICTION_OUTCOMES,
  type PredictionOutcome,
  updateReviewStatus,
  updateSpacedRepetition,
  updateStarStatus,
  replaceInsight,
  type Difficulty,
} from "@/lib/parser";
import {
  applyReviewToQueueCache,
  applyCheckToQueueCache,
} from "@/lib/review-queue";
import { todayISO } from "@/lib/time";
import { appendNote, MY_TAKE } from "@/lib/notes";

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
  // Your own words on this idea (optional): a reaction, a use, or — for a
  // contest — what you disagree with. Appended to the note's `## My Take`.
  const myTake = ((formData.get("myTake") as string | null) ?? "").trim();

  if (!path || !action) redirect("/review");

  const today = todayISO();

  const srActions: Difficulty[] = ["easy", "medium", "hard", "forgot"];
  const isSR = srActions.includes(action as Difficulty);
  const isStar = action === "star" || action === "unstar";
  // "verify-came-true" etc.: judging a prediction, not reviewing the idea.
  const outcome = action.startsWith("verify-")
    ? (action.slice("verify-".length) as PredictionOutcome)
    : null;
  const isVerify = !!outcome && PREDICTION_OUTCOMES.includes(outcome);

  const validAction =
    isSR || isStar || isVerify || action === "approve" || action === "contest";
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
    let base = applyInsight(source);
    if (myTake && !isStar) {
      base = appendNote(
        base,
        MY_TAKE,
        today,
        myTake,
        action === "contest"
          ? "contested"
          : isVerify
            ? `prediction ${outcome === "came-true" ? "came true" : outcome === "partly" ? "partly true" : "wrong"}`
            : ""
      );
    }
    if (isVerify) return updatePredictionOutcome(base, outcome!, today);
    if (isSR) return updateSpacedRepetition(base, action as Difficulty, today);
    if (isStar) return updateStarStatus(base, action === "star");
    return updateReviewStatus(
      base,
      action === "approve" ? "reviewed" : "contested",
      today
    );
  };

  // Prediction checks get their own prefix so review stats don't count them.
  const message = isVerify
    ? `verify: ${outcome} "${slug}"`
    : `review: ${action} "${slug}"`;

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

  // Expire the tagged repo tree so the next read resolves fresh blob shas
  // instead of serving the pre-commit tree for up to its revalidate window.
  updateTag(TREE_TAG);

  // Keep the in-memory queue cache in step with the commit so the next card
  // render reflects this review immediately (status, dates, session position).
  if (isVerify) applyCheckToQueueCache(path, outcome!);
  else applyReviewToQueueCache(path, action, today);

  redirect(returnTo || "/review");
}
