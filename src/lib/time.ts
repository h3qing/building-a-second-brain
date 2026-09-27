// Tiny date helpers for the review timeline. All dates are YYYY-MM-DD calendar
// days, matching the frontmatter convention used across the vault; "today" is
// taken in APP_TIMEZONE (see localISODate).

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

// Reviews happen on the reader's calendar day, not UTC's: without this, an
// evening review west of Greenwich is dated tomorrow (and a streak can break
// or double-count). Set APP_TIMEZONE to an IANA zone, e.g. America/Los_Angeles.
// Unset or invalid → UTC, the previous behavior.
let dayFormatter: Intl.DateTimeFormat | null | undefined;

function getDayFormatter(): Intl.DateTimeFormat | null {
  if (dayFormatter !== undefined) return dayFormatter;
  const timeZone = process.env.APP_TIMEZONE;
  try {
    dayFormatter = timeZone
      ? new Intl.DateTimeFormat("en-US", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : null;
  } catch {
    dayFormatter = null; // RangeError: unknown zone
  }
  return dayFormatter;
}

// The calendar date (YYYY-MM-DD) of an instant in APP_TIMEZONE.
export function localISODate(at: Date = new Date()): string {
  const fmt = getDayFormatter();
  if (!fmt) return at.toISOString().slice(0, 10);
  const parts = fmt.formatToParts(at);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function todayISO(): string {
  return localISODate();
}

// Calendar arithmetic on YYYY-MM-DD strings. Done in UTC so the result never
// depends on the server's own timezone.
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Human-readable date for display, e.g. "Jun 1, 2026". Accepts a string or Date.
export function formatDate(value: unknown): string | undefined {
  const iso = toISODate(value);
  if (!iso) return undefined;
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
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

// Compact interval for rating buttons: "1d", "12d", "3mo".
export function shortSpan(days: number): string {
  return days < 60 ? `${days}d` : `${Math.round(days / 30)}mo`;
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
