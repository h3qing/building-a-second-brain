"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { verifySession } from "@/lib/auth";
import { getFileContent, updateFile, TREE_TAG } from "@/lib/github";
import { appendNote, MY_SIDE } from "@/lib/notes";
import { todayISO } from "@/lib/time";

// Record where you stand on a concept's tension: appends a dated line to the
// concept note's `## My Side`. Taking a side is how a tension turns into
// something you could write.
export async function takeSideAction(formData: FormData) {
  if (!(await verifySession())) redirect("/login");

  const path = (formData.get("path") as string) || "";
  const side = ((formData.get("side") as string | null) ?? "").trim();
  // Only ever back to the tensions page (no open redirect via the form).
  const back = (formData.get("returnTo") as string) || "";
  const returnTo = back.startsWith("/tensions") ? back : "/tensions";

  // Concept notes only — this action can't write anywhere else in the vault.
  if (!/^30 Concept\/[^/]+\.md$/.test(path) || path.includes("..")) {
    redirect("/tensions");
  }
  if (!side) redirect(returnTo);

  const file = await getFileContent(path);
  if (!file) redirect("/tensions");

  const concept = path.split("/").pop()?.replace(/\.md$/, "") || "concept";
  await updateFile(
    path,
    appendNote(file.content, MY_SIDE, todayISO(), side),
    file.sha,
    `side: "${concept}"`
  );
  updateTag(TREE_TAG);
  redirect(returnTo);
}
