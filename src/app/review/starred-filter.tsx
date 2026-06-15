"use client";

import { useState, type ReactNode } from "react";

// Client-side toggle that narrows the queue to starred notes without
// reordering it. The server renders every section as `children`; flipping the
// `rq-filtered` class hides the non-starred cards (and any now-empty source
// groups, sections, and counts) via CSS, so the queue keeps its order and all
// the grouping stays server-rendered.
export function StarredFilter({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const [active, setActive] = useState(false);

  // Nothing starred yet — no toggle, just pass the queue straight through.
  if (count === 0) return <>{children}</>;

  return (
    <div className={`space-y-10${active ? " rq-filtered" : ""}`}>
      <div>
        <button
          type="button"
          onClick={() => setActive((on) => !on)}
          className={`rq-starred-filter${active ? " is-active" : ""}`}
          aria-pressed={active}
        >
          ★ Starred ({count})
        </button>
      </div>
      {children}
    </div>
  );
}
