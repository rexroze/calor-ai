/**
 * Pure daily-target math: Mifflin-St Jeor BMR → activity-scaled TDEE →
 * goal-adjusted calories → macro split. No runtime imports, no I/O — safe to
 * unit-test and reuse from any server or client component.
 */

export type Sex = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";

/** Standard Mifflin-St Jeor activity multipliers applied to BMR. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

export type GoalIntent = "lose" | "maintain" | "gain";

/** Daily kcal adjustment applied on top of TDEE for each intent. */
export const GOAL_ADJUSTMENTS: Record<GoalIntent, number> = {
  lose: -500,
  maintain: 0,
  gain: 250,
};

/** Safety minimums — a prescription never goes below these. */
export const MIN_CALORIES: Record<Sex, number> = { female: 1200, male: 1500 };

/** Body measurements the formulas consume (metric). */
export interface BodyStats {
  sex: Sex;
  /** Age in years. */
  age: number;
  heightCm: number;
  weightKg: number;
}

/**
 * Resting metabolic rate via Mifflin-St Jeor (1990):
 * male   = 10·kg + 6.25·cm − 5·age + 5
 * female = male − 161
 */
export function basalMetabolicRate(body: BodyStats): number {
  const base = 10 * body.weightKg + 6.25 * body.heightCm - 5 * body.age + 5;
  return body.sex === "female" ? base - 161 : base;
}

/** TDEE = BMR × activity factor. */
export function totalDailyEnergyExpenditure(
  body: BodyStats,
  activity: ActivityLevel,
): number {
  return basalMetabolicRate(body) * ACTIVITY_FACTORS[activity];
}

/**
 * Calorie target: TDEE adjusted by goal intent, floored at the sex-specific
 * safety minimum (1200 female / 1500 male).
 */
export function calorieTarget(
  tdee: number,
  intent: GoalIntent,
  sex: Sex,
): number {
  return Math.max(tdee + GOAL_ADJUSTMENTS[intent], MIN_CALORIES[sex]);
}

/** Protein: 1.6 g per kg of bodyweight. */
export function proteinGrams(weightKg: number): number {
  return 1.6 * weightKg;
}

/** Fat: 30% of the calorie target ÷ 9 kcal/g. */
export function fatGrams(calories: number): number {
  return (0.3 * calories) / 9;
}

/** Carbs: calories left after protein and fat ÷ 4 kcal/g, never negative. */
export function carbohydrateGrams(
  calories: number,
  proteinG: number,
  fatG: number,
): number {
  return Math.max(0, (calories - proteinG * 4 - fatG * 9) / 4);
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export interface TargetsInput extends BodyStats {
  activity: ActivityLevel;
  intent: GoalIntent;
}

export interface ComputedTargets {
  /** Resting metabolic rate, kcal/day. */
  bmr: number;
  /** Maintenance energy (BMR × factor), kcal/day. */
  tdee: number;
  /** Final calorie goal, rounded to the nearest 10. */
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Full pipeline. Calories are rounded to the nearest 10 BEFORE macros are
 * derived, so the editable plan panel stays internally consistent
 * (protein·4 + carbs·4 + fat·9 ≈ calories). Macros round to whole grams.
 */
export function computeTargets(input: TargetsInput): ComputedTargets {
  const bmr = basalMetabolicRate(input);
  const tdee = totalDailyEnergyExpenditure(input, input.activity);
  const calories = roundTo(calorieTarget(tdee, input.intent, input.sex), 10);

  const proteinG = Math.round(proteinGrams(input.weightKg));
  const fatG = Math.round(fatGrams(calories));
  const carbsG = Math.round(carbohydrateGrams(calories, proteinG, fatG));

  return { bmr, tdee, calories, proteinG, carbsG, fatG };
}
