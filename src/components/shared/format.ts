/** Deterministic display formatting shared by server and client islands. */

const kcalFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatKcal(n: number): string {
  return kcalFormat.format(Math.round(Number.isFinite(n) ? n : 0));
}

/** Trim float noise: 42.300000000000004 -> "42.3", 42 -> "42". */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function parseNonNegative(s: string): number {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
