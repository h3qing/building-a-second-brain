"use client";

import { useState } from "react";

export function CopyBriefButton({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="label hover:text-foreground transition-colors"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(markdown);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable; no-op
        }
      }}
    >
      {copied ? "copied ✓" : "copy brief"}
    </button>
  );
}
