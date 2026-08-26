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
export const foodAnalysisItemSchema = z.object({
  name: z.string().describe("Food name, e.g. 'Grilled chicken breast'"),
  portionDescription: z
    .string()
    .describe("Estimated portion, e.g. '150 g' or '1 cup cooked rice'"),
  calories: z.number().min(0).max(5000),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
  confidence: z.enum(["high", "medium", "low"]),
});

export const foodAnalysisSchema = z.object({
  items: z.array(foodAnalysisItemSchema).min(1).max(15),
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
