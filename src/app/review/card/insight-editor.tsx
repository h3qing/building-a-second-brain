"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewAction } from "@/app/review/action";
import { useRecall } from "./recall";
import type { DatedNote } from "@/lib/notes";

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
  // Your earlier `## My Take` lines on this idea, oldest first.
  earlierTakes: DatedNote[];
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
  earlierTakes,
}: ReviewCardFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"ai" | "custom">("ai");
  const [customText, setCustomText] = useState("");
  // Your own words, saved with whichever button you press. Contest asks for
  // them first: a disagreement is the most useful thing a review can record.
  const [take, setTake] = useState("");
  const [takeOpen, setTakeOpen] = useState(false);
  const [contestArmed, setContestArmed] = useState(false);
  const takeRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => {
    if (takeOpen) takeRef.current?.focus();
  }, [takeOpen, contestArmed]);

  // Contest's first press (or "c"): open the take box and ask for a reason.
  const armContest = () => {
    setContestArmed(true);
    setTakeOpen(true);
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

      if (e.key === "t" || e.key === "T") {
        e.preventDefault(); // don't type the "t" into the box it opens
        setTakeOpen(true);
        return;
      }

      const submit = (form: HTMLFormElement | null) => form?.requestSubmit();

      if (isReReview) {
        if (e.key === "1") submit(easyFormRef.current);
        else if (e.key === "2") submit(mediumFormRef.current);
        else if (e.key === "3") submit(hardFormRef.current);
        else if (e.key === "4") submit(forgotFormRef.current);
      } else if (e.key === "a" || e.key === "A") {
        submit(approveFormRef.current);
      } else if (e.key === "c" || e.key === "C") {
        if (take.trim() || contestArmed) submit(contestFormRef.current);
        else {
          e.preventDefault();
          armContest();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    revealed,
    reveal,
    isLoggedIn,
    isReReview,
    prevHref,
    nextHref,
    router,
    take,
    contestArmed,
  ]);

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
        ? "1 easy · 2 medium · 3 hard · 4 forgot · t take · ←→ navigate"
        : "a approve · c contest · t take · ←→ navigate";

  // The fields every review form posts: which note, where to go next, the
  // (possibly edited) insight, and your take.
  const commonFields = (
    <>
      <input type="hidden" name="path" value={currentPath} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="sha" value={sha} />
      <input type="hidden" name="rawContent" value={rawContent} />
      <input type="hidden" name="customInsight" value={activeInsight} />
      <input
        type="hidden"
        name="insightChanged"
        value={insightChanged ? "true" : "false"}
      />
      <input type="hidden" name="myTake" value={take} />
    </>
  );

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

      {/* Reveal sits outside the insight section so that on phones it can
          dock to the bottom of the screen (sticky can't leave its parent). */}
      {!revealed && (
        <div className="action-dock">
          <button
            type="button"
            className="btn btn-nav w-full text-lg"
            onClick={reveal}
          >
            Reveal insight
          </button>
        </div>
      )}

      {/* Your own words — earlier takes, then room for a new one */}
      {revealed && isLoggedIn && (
        <section className="space-y-3">
          {earlierTakes.length > 0 && (
            <div className="my-takes">
              <h2 className="label">You wrote</h2>
              <ul>
                {earlierTakes
                  .slice(-3)
                  .reverse()
                  .map((n, i) => (
                    <li key={i}>
                      {n.date && (
                        <span className="my-take-date">
                          {n.date}
                          {n.label && ` · ${n.label}`}
                        </span>
                      )}{" "}
                      {n.text}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {takeOpen ? (
            <div className="space-y-2">
              <label className="label" htmlFor="my-take">
                {contestArmed ? "What do you disagree with?" : "Your take"}
              </label>
              <textarea
                id="my-take"
                ref={takeRef}
                className="insight-textarea"
                value={take}
                onChange={(e) => setTake(e.target.value)}
                placeholder={
                  contestArmed
                    ? "The claim, the evidence, or where it breaks. Saved to My Take."
                    : isReReview
                      ? "What stuck, what changed, what it connects to. Optional."
                      : "In your own words, or where you'd use it. Optional."
                }
                rows={3}
              />
            </div>
          ) : (
            <button
              type="button"
              className="insight-toggle"
              onClick={() => setTakeOpen(true)}
            >
              + Add your take
            </button>
          )}
        </section>
      )}

      {/* Action buttons — hidden until revealed in recall mode (rate after recalling) */}
      {revealed && (
        <div className="pt-2 action-dock">
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
                    <input type="hidden" name="action" value={difficulty} />
                    {commonFields}
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
                <input type="hidden" name="action" value="approve" />
                {commonFields}
                <button type="submit" className="btn btn-approve w-full text-lg">
                  Approve
                </button>
              </form>

              <form
                action={reviewAction}
                ref={contestFormRef}
                onSubmit={markSubmitted}
              >
                <input type="hidden" name="action" value="contest" />
                {commonFields}
                <button
                  type="submit"
                  className="btn btn-contest w-full text-lg"
                  onClick={(e) => {
                    // First press asks why; the second one files it (a note
                    // is encouraged, not required).
                    if (!take.trim() && !contestArmed) {
                      e.preventDefault();
                      armContest();
                    }
                  }}
                >
                  {contestArmed ? "Contest with this note" : "Contest"}
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
