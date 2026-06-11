// Tiny date helpers for the review timeline. All dates are YYYY-MM-DD (UTC),
// matching the frontmatter convention used across the vault.

// Frontmatter dates may arrive as strings or as Date objects (js-yaml parses
// unquoted ISO dates). Normalize both to YYYY-MM-DD.
export function toISODate(value: unknown): string | undefined {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return undefined;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (Date.parse(toISO + "T00:00:00Z") - Date.parse(fromISO + "T00:00:00Z")) /
      86_400_000
  );
}

// Human span: "1 day", "6 days", "3 weeks", "4 months", "a year", "2 years"
export function spanLabel(days: number): string {
  if (days <= 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = Math.round(days / 365);
  return years <= 1 ? "a year" : `${years} years`;
}

export function timeAgo(iso: string, today: string): string {
  const d = daysBetween(iso, today);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${spanLabel(d)} ago`;
}

export function timeUntil(iso: string, today: string): string {
  const d = daysBetween(today, iso);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${spanLabel(d)}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "Mar 2024" — coarse, for source publish dates
export function monthYear(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}
