/**
 * Local-day date helpers. Everything is keyed by a plain `YYYY-MM-DD`
 * string in the user's local day — no UTC drift, no Date object leaks.
 */

const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateISO(value: string | undefined | null): value is string {
  if (!value || !DATE_ISO_RE.test(value)) return false;
  const d = new Date(`${value}T12:00:00`);
  return !Number.isNaN(d.getTime()) && toISODate(d) === value;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Midday anchor keeps day arithmetic stable across DST shifts. */
function fromISO(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

export function addDaysISO(iso: string, days: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/**
 * Human label for the date navigator.
 * "Today" and "Yesterday" when they apply, otherwise e.g. "Tue, Aug 25".
 */
export function formatDayLabel(iso: string, todayIso: string): string {
  if (iso === todayIso) return "Today";
  if (iso === addDaysISO(todayIso, -1)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(fromISO(iso));
}

/** Short clock time for meal captions, e.g. "8:04 AM". */
export function formatTime(eatenAtISO: string): string {
  const d = new Date(eatenAtISO);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
