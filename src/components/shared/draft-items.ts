import type {
  FoodAnalysisItem,
  FoodItemInput,
  MacroTotals,
} from "@/lib/contracts";
import { fmtNum, parseNonNegative } from "@/components/shared/format";

/**
 * Editable item rows keep every field as a string while the user types;
 * numbers are parsed only on totals display and save.
 */

/** Macro fields the portion-multiplier chips can scale. */
export type ScaledField = "calories" | "proteinG" | "carbsG" | "fatG";

/**
 * Anchor state behind the portion-multiplier chips.
 *
 * Model: displayed numbers derive from `base × multiplier` until the user
 * edits a field by hand — that field then detaches permanently and chips
 * never touch it again (its literal string wins). Hand-added rows have no
 * anchor until the first chip press or manual edit snapshots their current
 * values as the base. Because chip presses REWRITE these strings, totals
 * (sumDrafts) and the save payload (draftToFoodItemInput) see scaled values
 * with no extra plumbing.
 */
export type DraftScaling = {
  /** Multiplier currently reflected in the displayed strings. */
  multiplier: number;
  /** Estimates chips scale from (AI output, or a snapshot for hand rows). */
  base: Record<ScaledField, number>;
  /** Fields manually edited since anchoring — excluded from future scaling. */
  detached: ScaledField[];
  /** Leading "<n> g" captured from the portion text at anchor time. */
  portionGrams: number | null;
  /** Set once the user edits the portion text; gram rewriting stops. */
  portionDetached: boolean;
};

export type DraftItem = {
  name: string;
  portionDescription: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  confidence?: "high" | "medium" | "low";
  /** Present only once an anchor exists (analysis output or first chip use). */
  scaling?: DraftScaling;
};

export function emptyDraftItem(): DraftItem {
  return {
    name: "",
    portionDescription: "",
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
  };
}

/**
 * Analysis row → editable draft, anchored so chips scale straight from the
 * model's original estimate (1× reproduces these exact numbers).
 */
export function draftFromAnalysis(item: FoodAnalysisItem): DraftItem {
  return {
    name: item.name,
    portionDescription: item.portionDescription,
    calories: String(Math.round(item.calories)),
    proteinG: String(fmtNum(item.proteinG)),
    carbsG: String(fmtNum(item.carbsG)),
    fatG: String(fmtNum(item.fatG)),
    confidence: item.confidence,
    scaling: {
      multiplier: 1,
      base: {
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
      },
      detached: [],
      portionGrams: parsePortionGrams(item.portionDescription),
      portionDetached: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Portion-multiplier helpers
// ---------------------------------------------------------------------------

/**
 * Matches a leading weight figure ("150 g", "1.5 grams") so chip presses can
 * rescale the grams mentioned in the free-text portion description.
 */
const PORTION_GRAMS_PATTERN = /^(\s*)(\d+(?:[.,]\d+)?)(\s*(?:g|grams?)\b.*)?$/i;

/** Leading grams figure of a portion description, or null when absent. */
export function parsePortionGrams(text: string): number | null {
  const match = PORTION_GRAMS_PATTERN.exec(text);
  if (!match) return null;
  const value = Number.parseFloat(match[2].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function rewritePortionGrams(text: string, grams: number): string {
  return text.replace(
    PORTION_GRAMS_PATTERN,
    (_match, lead: string, _num: string, rest?: string) =>
      `${lead}${fmtNum(grams)}${rest ?? ""}`,
  );
}

/** Anchor for rows without one: snapshot whatever is currently on screen. */
function anchorFromCurrent(item: DraftItem): DraftScaling {
  return {
    multiplier: 1,
    base: {
      calories: parseNonNegative(item.calories),
      proteinG: parseNonNegative(item.proteinG),
      carbsG: parseNonNegative(item.carbsG),
      fatG: parseNonNegative(item.fatG),
    },
    detached: [],
    portionGrams: parsePortionGrams(item.portionDescription),
    portionDetached: false,
  };
}

/**
 * Apply a preset multiplier: every attached field is recomputed as
 * `base × multiplier` (calories round-trip as whole kcal, macros keep one
 * decimal). Detached fields and a hand-edited portion text pass through
 * untouched. Idempotent — repeated presses derive from the same base.
 */
export function withMultiplier(item: DraftItem, multiplier: number): DraftItem {
  const scaling = item.scaling ?? anchorFromCurrent(item);

  const scaled = (field: ScaledField): string => {
    if (scaling.detached.includes(field)) return item[field];
    const value = scaling.base[field] * multiplier;
    return field === "calories"
      ? String(Math.round(value))
      : fmtNum(value);
  };

  const portionDescription =
    !scaling.portionDetached && scaling.portionGrams !== null
      ? rewritePortionGrams(item.portionDescription, scaling.portionGrams * multiplier)
      : item.portionDescription;

  return {
    ...item,
    calories: scaled("calories"),
    proteinG: scaled("proteinG"),
    carbsG: scaled("carbsG"),
    fatG: scaled("fatG"),
    portionDescription,
    scaling: { ...scaling, multiplier },
  };
}

/**
 * A keystroke in a macro field detaches it from chip scaling for good; the
 * typed string becomes the source of truth from here on.
 */
export function withManualMacroEdit(
  item: DraftItem,
  field: ScaledField,
  rawValue: string,
): DraftItem {
  const scaling = item.scaling ?? anchorFromCurrent(item);
  const detached = scaling.detached.includes(field)
    ? scaling.detached
    : [...scaling.detached, field];
  return { ...item, [field]: rawValue, scaling: { ...scaling, detached } };
}

/** Manual portion-text edits opt that text out of gram rewriting. */
export function withManualPortionEdit(
  item: DraftItem,
  rawValue: string,
): DraftItem {
  if (!item.scaling || item.scaling.portionDetached) {
    return { ...item, portionDescription: rawValue };
  }
  return {
    ...item,
    portionDescription: rawValue,
    scaling: { ...item.scaling, portionDetached: true, portionGrams: null },
  };
}

/**
 * True once the user has hand-tuned any scaled field — the chip row shows a
 * custom-state marker instead of highlighting a preset.
 */
export function isCustomAmount(item: DraftItem): boolean {
  return !!item.scaling && item.scaling.detached.length > 0;
}

// ---------------------------------------------------------------------------
// Totals + persistence (read the displayed strings — already scaled)
// ---------------------------------------------------------------------------

export function draftToFoodItemInput(d: DraftItem): FoodItemInput {
  return {
    name: d.name.trim(),
    portionDescription: d.portionDescription.trim(),
    calories: parseNonNegative(d.calories),
    proteinG: parseNonNegative(d.proteinG),
    carbsG: parseNonNegative(d.carbsG),
    fatG: parseNonNegative(d.fatG),
  };
}

export function isDraftMeaningful(d: DraftItem): boolean {
  return (
    d.name.trim().length > 0 ||
    parseNonNegative(d.calories) > 0 ||
    parseNonNegative(d.proteinG) > 0 ||
    parseNonNegative(d.carbsG) > 0 ||
    parseNonNegative(d.fatG) > 0
  );
}

export function sumDrafts(drafts: DraftItem[]): MacroTotals {
  return drafts.reduce<MacroTotals>(
    (acc, d) => ({
      calories: acc.calories + parseNonNegative(d.calories),
      proteinG: acc.proteinG + parseNonNegative(d.proteinG),
      carbsG: acc.carbsG + parseNonNegative(d.carbsG),
      fatG: acc.fatG + parseNonNegative(d.fatG),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}
