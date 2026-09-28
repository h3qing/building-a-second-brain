import matter from "gray-matter";
import { stringifyNote } from "./parser";

// Human-owned sections: your own words, kept apart from the AI's. The vault
// pipeline never writes them (see vault CLAUDE.md); the app only appends a
// dated line. They stay off public pages — they're thinking, not publishing.
export const MY_TAKE = "My Take"; // idea notes: reactions, disagreements, uses
export const MY_SIDE = "My Side"; // concept notes: your position on the tension

export interface DatedNote {
  date: string; // YYYY-MM-DD, "" for a free-form line written in Obsidian
  label: string; // e.g. "contested"; "" when plain
  text: string;
}

const MAX_NOTE = 2000;
const NOTE_LINE = /^[-*]\s+(\d{4}-\d{2}-\d{2})(?:\s+\(([^)]*)\))?:\s*(.*)$/;

function sectionRe(heading: string): RegExp {
  return new RegExp(`(^|\\n)##\\s+${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
}

// The dated lines of a section, oldest first. Free-form lines (added by hand
// in Obsidian) come back undated rather than being dropped.
export function readNotes(content: string, heading: string): DatedNote[] {
  const m = content.match(sectionRe(heading));
  if (!m) return [];
  const notes: DatedNote[] = [];
  for (const raw of m[2].replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const n = line.match(NOTE_LINE);
    notes.push(
      n
        ? { date: n[1], label: n[2] || "", text: n[3] }
        : { date: "", label: "", text: line.replace(/^[-*]\s+/, "") }
    );
  }
  return notes;
}

// Remove a section (heading included) from a note body — for public pages.
export function stripSection(content: string, heading: string): string {
  return content.replace(sectionRe(heading), "$1").replace(/\n{3,}/g, "\n\n");
}

// Append "- YYYY-MM-DD (label): text" to a section, creating the section at
// the end of the body when it doesn't exist yet. Frontmatter is preserved.
export function appendNote(
  rawFile: string,
  heading: string,
  date: string,
  text: string,
  label = ""
): string {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE);
  if (!clean) return rawFile;
  const line = `- ${date}${label ? ` (${label})` : ""}: ${clean}`;

  const { data, content } = matter(rawFile);
  const body = content.replace(/\s+$/, "");
  const re = sectionRe(heading);
  const m = body.match(re);
  const next = m
    ? body.replace(re, (_all, lead: string, inner: string) => {
        const kept = inner.replace(/\s+$/, "");
        return `${lead}## ${heading}\n${kept ? `${kept}\n` : "\n"}${line}`;
      })
    : `${body}\n\n## ${heading}\n\n${line}`;
  return stringifyNote(next + "\n", data);
}
