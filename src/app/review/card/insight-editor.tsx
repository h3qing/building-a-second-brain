"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewAction } from "@/app/review/action";
import { useRecall } from "./recall";

interface ReviewCardFormProps {
  currentPath: string;
  sha: string;
  rawContent: string;
  returnTo: string;
  isReReview: boolean;
  aiInsight: string;
  insightParagraphs: string[];
  isLoggedIn: boolean;
  // What the reader recalls from while the answer is hidden: the card's
  // `## Recall` question, the book highlight shown above, or just the title.
  cue: "question" | "highlight" | "title";
  recallQuestion: string;
  // Prev/next card hrefs for arrow-key navigation (null at the queue edges).
  prevHref: string | null;
  nextHref: string | null;
  // Re-reviews: when each rating would bring the card back, e.g. "12d".
  ratingHints?: Partial<Record<Rating, string>>;
}

const RATINGS = ["easy", "medium", "hard", "forgot"] as const;
type Rating = (typeof RATINGS)[number];

const RECALL_PROMPT: Record<ReviewCardFormProps["cue"], string> = {
  question: "Answer it out loud, then reveal to check yourself.",
  highlight:
    "Recall the insight from the highlight above. Say it out loud, then reveal to check yourself.",
  title:
    "What's the insight behind this, and why does it hold? Say it out loud, then reveal to check yourself.",
};

export function ReviewCardForm({
  currentPath,
  sha,
  rawContent,
  returnTo,
  isReReview,
  aiInsight,
  insightParagraphs,
  isLoggedIn,
  cue,
  recallQuestion,
  prevHref,
  nextHref,
  ratingHints,
}: ReviewCardFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"ai" | "custom">("ai");
  const [customText, setCustomText] = useState("");
  // Hidden until revealed in recall mode (state shared with the page's other
  // answer-bearing sections via RecallProvider).
  const { revealed, reveal } = useRecall();

  // Keyboard shortcuts drive the existing forms via requestSubmit(), so a
  // submit here is exactly the same server action as a button click.
  const easyFormRef = useRef<HTMLFormElement>(null);
  const mediumFormRef = useRef<HTMLFormElement>(null);
  const hardFormRef = useRef<HTMLFormElement>(null);
  const forgotFormRef = useRef<HTMLFormElement>(null);
  const approveFormRef = useRef<HTMLFormElement>(null);
  const contestFormRef = useRef<HTMLFormElement>(null);
  // Each rating submit is a real GitHub commit, so once any form submits the
  // shortcuts disarm until the next card.
  const submittedRef = useRef(false);

  const ratingFormRefs = {
    easy: easyFormRef,
    medium: mediumFormRef,
    hard: hardFormRef,
    forgot: forgotFormRef,
  };

  // Client state survives searchParams-only navigation, so re-arm the
  // shortcuts whenever the card changes.
  useEffect(() => {
    submittedRef.current = false;
  }, [currentPath]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't hijack keys while the user is typing (e.g. the insight editor).
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
        return;
      }

      if (e.key === "ArrowLeft" && prevHref) {
        router.push(prevHref);
        return;
      }
      if (e.key === "ArrowRight" && nextHref) {
        router.push(nextHref);
        return;
      }

      // Rating keys arm only after reveal; the flag blocks double-submits.
      if (!revealed || !isLoggedIn || submittedRef.current) return;

      const submit = (form: HTMLFormElement | null) => form?.requestSubmit();

      if (isReReview) {
        if (e.key === "1") submit(easyFormRef.current);
        else if (e.key === "2") submit(mediumFormRef.current);
        else if (e.key === "3") submit(hardFormRef.current);
        else if (e.key === "4") submit(forgotFormRef.current);
      } else if (e.key === "a" || e.key === "A") {
        submit(approveFormRef.current);
      } else if (e.key === "c" || e.key === "C") {
        submit(contestFormRef.current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [revealed, reveal, isLoggedIn, isReReview, prevHref, nextHref, router]);

  // Set on any submit (click or key) so a follow-up shortcut can't
  // double-commit.
  const markSubmitted = () => {
    submittedRef.current = true;
  };

  const insightChanged = mode === "custom" && customText.trim() !== "";
  const activeInsight = insightChanged ? customText : aiInsight;

  const keyHints = !revealed
    ? "space reveal · ←→ navigate"
    : !isLoggedIn
      ? "←→ navigate"
      : isReReview
        ? "1 easy · 2 medium · 3 hard · 4 forgot · ←→ navigate"
        : "a approve · c contest · ←→ navigate";

  return (
    <>
      {/* Insight section */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="label">Insight</h2>
          {isLoggedIn && revealed && (
            <div className="flex items-center gap-4">
              {mode === "ai" ? (
                <>
                  <button
                    type="button"
                    className="insight-toggle"
                    onClick={() => {
                      // Seed the editor with the existing insight so it can be
                      // tweaked instead of rewritten from scratch.
                      setCustomText(aiInsight);
                      setMode("custom");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="insight-toggle"
                    onClick={() => {
                      setCustomText("");
                      setMode("custom");
                    }}
                  >
                    Write your own
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="insight-toggle"
                  onClick={() => setMode("ai")}
                >
                  Use AI insight
                </button>
              )}
            </div>
          )}
        </div>

        {revealed && recallQuestion && (
          <p className="recall-question-small">
            <span className="label">Q</span> {recallQuestion}
          </p>
        )}

        {!revealed ? (
          <div className="space-y-3">
            <p className="text-muted">{RECALL_PROMPT[cue]}</p>
            <button
              type="button"
              className="btn btn-nav w-full text-lg"
              onClick={reveal}
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
              <div className="action-row rating-row">
                {RATINGS.map((difficulty) => (
                  <form
                    key={difficulty}
                    action={reviewAction}
                    ref={ratingFormRefs[difficulty]}
                    onSubmit={markSubmitted}
                  >
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
                      className={`btn btn-${difficulty} btn-rating w-full capitalize`}
                    >
                      <span>{difficulty}</span>
                      {ratingHints?.[difficulty] && (
                        <span className="rating-hint">
                          {ratingHints[difficulty]}
                        </span>
                      )}
                    </button>
                  </form>
                ))}
              </div>
            </>
          ) : (
            <div className="action-row">
              <form
                action={reviewAction}
                ref={approveFormRef}
                onSubmit={markSubmitted}
              >
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

              <form
                action={reviewAction}
                ref={contestFormRef}
                onSubmit={markSubmitted}
              >
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

      {/* Shortcut legend — CSS hides it on e-ink and touch devices */}
      <p className="key-hints label">{keyHints}</p>
    </>
  );
}
