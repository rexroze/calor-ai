import type { FoodItemInput, MacroTotals } from "@/lib/contracts";
import { parseNonNegative } from "@/components/shared/format";

/**
 * Editable item rows keep every field as a string while the user types;
 * numbers are parsed only on totals display and save.
 */
export type DraftItem = {
  name: string;
  portionDescription: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  confidence?: "high" | "medium" | "low";
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
