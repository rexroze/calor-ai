/**
 * calorAI shared contracts.
 * Single source of truth for cross-lane integration.
 * Lane A (data/auth/AI) IMPLEMENTS these. Lane B (UI) CONSUMES them.
 * Do not rename or move without updating this file and both lanes.
 */

import { z } from "zod";

// ---------- Domain enums ----------
export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

// ---------- AI analysis (Groq vision) ----------
/**
 * Tolerant parsing rules for model output. Groq/Qwen frequently emits
 * stringly-typed JSON ("450" for numbers, "true" for booleans), omits fields,
 * or invents out-of-range values. Every field below absorbs that: coercion +
 * bounded ranges + `.catch()` fallbacks mean a parse NEVER crashes the
 * analysis chain — worst case it degrades to zeroed data the UI can show.
 */

/** Consumer-facing confidence label (order matters: first entry is the fallback). */
export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/**
 * Boolean accepting true/false/"true"/"false"/1/0 → boolean.
 * Anything else parses as `false` (honest default: not food).
 */
const booleanishSchema = z
  .union([
    z.boolean(),
    z.literal("true"),
    z.literal("false"),
    z.literal(1),
    z.literal(0),
  ])
  .transform((value) =>
    typeof value === "boolean" ? value : value === "true" || value === 1,
  )
  .catch(false);

/**
 * Enum widened to string with normalization; unknown values fall back to the
 * FIRST valid level ("low") instead of hard-failing the whole parse.
 */
const confidenceLabelSchema = z
  .string()
  .transform((s) => {
    const normalized = s.trim().toLowerCase();
    return (CONFIDENCE_LEVELS as readonly string[]).includes(normalized)
      ? (normalized as ConfidenceLevel)
      : CONFIDENCE_LEVELS[0];
  })
  .catch(CONFIDENCE_LEVELS[0]);

/** Numeric fields coerce strings and collapse NaN/out-of-range junk to the fallback. */
const macroNumber = z.coerce.number().min(0).max(5000).catch(0);
const gramNumber = z.coerce.number().min(0).max(10_000).catch(0);

export const foodAnalysisItemSchema = z.object({
  name: z.string().min(1).catch("Unknown food"),
  portionDescription: z.string().catch(""),
  calories: macroNumber,
  proteinG: gramNumber,
  carbsG: gramNumber,
  fatG: gramNumber,
  confidence: confidenceLabelSchema,
});

/**
 * Single-dish analysis contract returned by the vision model (see
 * `SYSTEM_PROMPT` in lib/ai.ts). Kept tolerant per the rules above:
 *
 * - `isFood` false ⇒ treat as "no food detected" upstream (`items` stays empty).
 * - Empty `items` is ALLOWED at parse level ("no food detected" signal);
 *   lib/ai.ts materializes one item from the dish-level fields when food was
 *   identified, so consumers always receive reviewable rows for real food.
 * - `confidence` is calibrated certainty in `dishName` alone, 0–1.
 */
export const foodAnalysisSchema = z.object({
  isFood: booleanishSchema.default(true),
  dishName: z.string().catch(""),
  portionGrams: gramNumber,
  portionDescription: z.string().catch(""),
  ingredients: z.array(z.string()).default([]).catch([]),
  cookingMethod: z.string().catch(""),
  calories: macroNumber,
  proteinG: gramNumber,
  carbsG: gramNumber,
  fatG: gramNumber,
  confidence: z.coerce.number().min(0).max(1).catch(0.5),
  items: z.array(foodAnalysisItemSchema).max(15).default([]).catch([]),
});
export type FoodAnalysisItem = z.infer<typeof foodAnalysisItemSchema>;
export type FoodAnalysis = z.infer<typeof foodAnalysisSchema>;

// ---------- Persistence payloads ----------
export type FoodItemInput = {
  name: string;
  portionDescription: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type SaveMealInput = {
  /** ISO date-time the meal was eaten; defaults to now */
  eatenAt?: string;
  mealType: MealType;
  note?: string;
  /** Blob URL of the stored photo, if any */
  photoUrl?: string;
  items: FoodItemInput[];
};

export type UpdateMealInput = SaveMealInput & { mealId: string };

export type FoodItemEntry = FoodItemInput & { id: string };

export type MealEntry = {
  id: string;
  mealType: MealType;
  eatenAt: string; // ISO datetime
  photoUrl: string | null;
  note: string | null;
  items: FoodItemEntry[];
};

export type MacroTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type DaySummary = {
  date: string; // YYYY-MM-DD in user's local day
  totals: MacroTotals;
  meals: MealEntry[];
};

export type Goals = MacroTotals;

// ---------- Server actions (implemented by Lane A) ----------
// Path: src/app/actions/meals.ts
export type MealsActions = {
  /** Full day diary + totals for a YYYY-MM-DD local date */
  getDay(dateISO: string): Promise<DaySummary>;
  analyzePhoto(base64Jpeg: string): Promise<FoodAnalysis>;
  saveMeal(input: SaveMealInput): Promise<{ mealId: string }>;
  updateMeal(input: UpdateMealInput): Promise<{ mealId: string }>;
  deleteMeal(mealId: string): Promise<void>;
};

// Path: src/app/actions/goals.ts
export type GoalsActions = {
  getGoals(): Promise<Goals>;
  saveGoals(goals: Goals): Promise<void>;
};
