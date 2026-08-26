/**
 * Unit conversion + display helpers for the metric/imperial preference.
 * Pure math — no client dependencies — safe for server components too.
 *
 * STORAGE CONTRACT (see shared/preferences.tsx): calorAI always STORES and
 * SAVES metric (kg, cm, ml). Imperial is strictly a display-layer conversion;
 * anything persisted goes back through the *ToMetric direction.
 */

export type Units = "metric" | "imperial";

/** Exact task-specified constant: 1 kg = 2.20462 lb. */
export const LB_PER_KG = 2.20462;

/** US fluid ounce ≈ 29.5735 ml. Water stays ml-first; oz is a hint only. */
export const ML_PER_FLOZ = 29.5735;

const CM_PER_IN = 2.54;

/** Trim float noise to ≤1 decimal: 81.64662 -> 81.6, 80 -> 80. */
function trimTo1(n: number): number {
  return Number.isFinite(n) ? Number(n.toFixed(1)) : 0;
}

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

/** Inverse of kgToLb — use when converting an imperial INPUT back for save. */
export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/**
 * Display weight. Imperial renders exactly 1 decimal ("163.1 lb");
 * metric keeps ≤1 decimal ("74 kg", "72.6 kg").
 */
export function formatWeight(kg: number, units: Units): string {
  const safe = Number.isFinite(kg) ? kg : 0;
  return units === "imperial"
    ? `${kgToLb(safe).toFixed(1)} lb`
    : `${trimTo1(safe)} kg`;
}

/** 171 cm -> { feet: 5, inches: 7 }; carries rounding into feet cleanly. */
export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round((Number.isFinite(cm) ? cm : 0) / CM_PER_IN);
  return {
    feet: Math.floor(totalInches / 12),
    inches: totalInches % 12,
  };
}

/** Inverse of cmToFtIn — for converting an imperial height input back. */
export function ftInToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_IN;
}

/** Display height: "171 cm" or 5'7". */
export function formatHeight(cm: number, units: Units): string {
  if (units === "imperial") {
    const { feet, inches } = cmToFtIn(cm);
    return `${feet}'${inches}"`;
  }
  return `${trimTo1(cm)} cm`;
}

export function mlToFlOz(ml: number): number {
  return (Number.isFinite(ml) ? ml : 0) / ML_PER_FLOZ;
}

/** Rounded whole-fluid-ounce string for the water-card hint: "42 oz". */
export function formatFlOz(ml: number): string {
  return `${Math.round(mlToFlOz(ml))} oz`;
}
