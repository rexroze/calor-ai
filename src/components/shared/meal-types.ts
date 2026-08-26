import type { MealType } from "@/lib/contracts";
import { MEAL_TYPES } from "@/lib/contracts";

export type { MealType };

export const MEAL_TYPE_ORDER = MEAL_TYPES;

/** Capitalized labels; keys stay lowercase contract values. */
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function isMealType(v: string | undefined | null): v is MealType {
  return !!v && (MEAL_TYPES as readonly string[]).includes(v);
}

/** Rough local-time inference used when no explicit type is preselected. */
export function inferMealType(now = new Date()): MealType {
  const h = now.getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}
