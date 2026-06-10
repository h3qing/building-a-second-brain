"use client";

import { useState } from "react";
import Link from "next/link";
import { reviewAction } from "@/app/review/action";

interface ReviewCardFormProps {
  currentPath: string;
  sha: string;
  rawContent: string;
  returnTo: string;
  isReReview: boolean;
  aiInsight: string;
  insightParagraphs: string[];
  isLoggedIn: boolean;
  // Active recall: hide the insight until the user chooses to reveal it, so
  // re-reviews test recall instead of just re-reading the answer.
  recallMode: boolean;
}

export function ReviewCardForm({
  currentPath,
  sha,
  rawContent,
  returnTo,
  isReReview,
  aiInsight,
  insightParagraphs,
  isLoggedIn,
  recallMode,
}: ReviewCardFormProps) {
  const [mode, setMode] = useState<"ai" | "custom">("ai");
  const [customText, setCustomText] = useState("");
  // In recall mode the insight starts hidden; otherwise it's always shown.
  const [revealed, setRevealed] = useState(!recallMode);

  const insightChanged = mode === "custom" && customText.trim() !== "";
  const activeInsight = insightChanged ? customText : aiInsight;

  return (
    <>
      {/* Insight section */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="label">Insight</h2>
          {isLoggedIn && revealed && (
            <button
              type="button"
              className="insight-toggle"
              onClick={() => setMode(mode === "ai" ? "custom" : "ai")}
            >
              {mode === "ai" ? "Write your own" : "Use AI insight"}
            </button>
          )}
        </div>

        {!revealed ? (
          <div className="space-y-3">
            <p className="text-muted">
              Recall the insight from the highlight above. Say it out loud, then
              reveal to check yourself.
            </p>
            <button
              type="button"
              className="btn btn-nav w-full text-lg"
              onClick={() => setRevealed(true)}
            >
              Reveal insight
            </button>
          </div>
        ) : mode === "ai" ? (
          <div className="read">
            {insightParagraphs.map((line, i) => (
              <p key={i} className={i === 0 ? "read-lede" : undefined}>
                {line}
              </p>
            ))}
          </div>
        ) : (
          <textarea
            className="insight-textarea"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Write your own insight about this highlight..."
            rows={4}
          />
        )}
      </section>

      {/* Action buttons — hidden until revealed in recall mode (rate after recalling) */}
      {revealed && (
        <div className="pt-2">
          {!isLoggedIn ? (
            <Link
              href="/login"
              className="btn w-full bg-foreground text-background border-foreground text-lg"
            >
              Sign in to review &rarr;
            </Link>
          ) : isReReview ? (
            <>
              <p className="text-sm text-muted text-center mb-3">
                How well did you recall this?
              </p>
              <div className="action-row">
                {(["easy", "medium", "hard"] as const).map((difficulty) => (
                  <form key={difficulty} action={reviewAction}>
                    <input type="hidden" name="path" value={currentPath} />
                    <input type="hidden" name="action" value={difficulty} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input type="hidden" name="sha" value={sha} />
                    <input type="hidden" name="rawContent" value={rawContent} />
                    <input
                      type="hidden"
                      name="customInsight"
                      value={activeInsight}
                    />
                    <input
                      type="hidden"
                      name="insightChanged"
                      value={insightChanged ? "true" : "false"}
                    />
                    <button
                      type="submit"
                      className={`btn btn-${difficulty} w-full text-lg capitalize`}
                    >
                      {difficulty}
                    </button>
                  </form>
                ))}
              </div>
            </>
          ) : (
            <div className="action-row">
              <form action={reviewAction}>
                <input type="hidden" name="path" value={currentPath} />
                <input type="hidden" name="action" value="approve" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="sha" value={sha} />
                <input type="hidden" name="rawContent" value={rawContent} />
                <input
                  type="hidden"
                  name="customInsight"
                  value={activeInsight}
                />
                <input
                  type="hidden"
                  name="insightChanged"
                  value={insightChanged ? "true" : "false"}
                />
                <button type="submit" className="btn btn-approve w-full text-lg">
                  Approve
                </button>
              </form>

              <form action={reviewAction}>
                <input type="hidden" name="path" value={currentPath} />
                <input type="hidden" name="action" value="contest" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="sha" value={sha} />
                <input type="hidden" name="rawContent" value={rawContent} />
                <input
                  type="hidden"
                  name="customInsight"
                  value={activeInsight}
                />
                <input
                  type="hidden"
                  name="insightChanged"
                  value={insightChanged ? "true" : "false"}
                />
                <button type="submit" className="btn btn-contest w-full text-lg">
                  Contest
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}
