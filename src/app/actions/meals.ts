"use server";

// Vision analysis can take several seconds on Groq's free tier; give the
// serverless function enough headroom (default would be far tighter).
export const maxDuration = 60;

import { put } from "@vercel/blob";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { analyzeFoodPhoto } from "@/lib/ai";
import {
  foodAnalysisSchema,
  MEAL_TYPES,
  type DaySummary,
  type FoodAnalysis,
  type FoodItemEntry,
  type MealEntry,
  type MacroTotals,
  type SaveMealInput,
  type UpdateMealInput,
} from "@/lib/contracts";
import { db } from "@/db";
import { foodItems, meals } from "@/db/schema";

// ---------------------------------------------------------------------------
// Session helpers — every action re-verifies auth; proxy coverage is never
// trusted on its own (see Next.js data-security guidance).
// ---------------------------------------------------------------------------

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user.id;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const foodItemInputSchema = z.object({
  name: z.string().min(1).max(200),
  portionDescription: z.string().min(1).max(300),
  calories: z.number().finite().min(0),
  proteinG: z.number().finite().min(0),
  carbsG: z.number().finite().min(0),
  fatG: z.number().finite().min(0),
});

const saveMealInputSchema = z.object({
  eatenAt: z.string().optional(),
  mealType: z.enum(MEAL_TYPES),
  note: z.string().optional(),
  photoUrl: z.string().optional(),
  items: z.array(foodItemInputSchema).min(1).max(50),
});

function parseEatenAt(eatenAt?: string): Date {
  if (!eatenAt) return new Date();
  const date = new Date(eatenAt);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_EATEN_AT");
  return date;
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

function sumTotals(items: FoodItemEntry[]): MacroTotals {
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  for (const item of items) {
    calories += item.calories;
    proteinG += item.proteinG;
    carbsG += item.carbsG;
    fatG += item.fatG;
  }
  // Calories as rounded ints, macros to 1 decimal place.
  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG * 10) / 10,
    carbsG: Math.round(carbsG * 10) / 10,
    fatG: Math.round(fatG * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Full day diary + totals for a YYYY-MM-DD local date. */
export async function getDay(dateISO: string): Promise<DaySummary> {
  const userId = await requireUserId();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    throw new Error("INVALID_DATE");
  }
  const start = new Date(`${dateISO}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (Number.isNaN(start.getTime())) {
    throw new Error("INVALID_DATE");
  }

  const dayMeals = await db
    .select()
    .from(meals)
    .where(
      and(eq(meals.userId, userId), gte(meals.eatenAt, start), lt(meals.eatenAt, end)),
    )
    .orderBy(asc(meals.eatenAt));

  const mealIds = dayMeals.map((meal) => meal.id);
  const itemsByMealId = new Map<string, FoodItemEntry[]>();
  if (mealIds.length > 0) {
    const items = await db
      .select()
      .from(foodItems)
      .where(inArray(foodItems.mealId, mealIds))
      .orderBy(asc(foodItems.id));
    for (const item of items) {
      const list = itemsByMealId.get(item.mealId) ?? [];
      list.push(item);
      itemsByMealId.set(item.mealId, list);
    }
  }

  const entries: MealEntry[] = dayMeals.map((meal) => ({
    id: meal.id,
    mealType: meal.mealType as MealEntry["mealType"],
    eatenAt: meal.eatenAt.toISOString(),
    photoUrl: meal.photoUrl,
    note: meal.note,
    items: itemsByMealId.get(meal.id) ?? [],
  }));

  const allItems = entries.flatMap((entry) => entry.items);

  return {
    date: dateISO,
    totals: sumTotals(allItems),
    meals: entries,
  };
}

/** Analyze a base64 JPEG photo with the Groq vision model. */
export async function analyzePhoto(base64Jpeg: string): Promise<FoodAnalysis> {
  await requireUserId();
  const parsed = foodAnalysisSchema.safeParse(
    await analyzeFoodPhoto(base64Jpeg),
  );
  if (!parsed.success) {
    throw new Error("AI_ANALYSIS_FAILED");
  }
  return parsed.data;
}

/**
 * Persist a meal photo to Vercel Blob and return its public URL.
 *
 * Never throws for storage problems: without BLOB_READ_WRITE_TOKEN (local dev)
 * this is a graceful no-op, and any upload failure degrades to a photoless
 * meal instead of blocking the log. Only an expired/missing session throws.
 */
export async function uploadMealPhoto(
  base64Jpeg: string,
): Promise<{ photoUrl: string | null }> {
  const userId = await requireUserId();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { photoUrl: null };
  }

  try {
    // The client sends raw base64; tolerate a stray data URL prefix anyway.
    const raw = base64Jpeg.slice(base64Jpeg.indexOf(",") + 1);
    const buffer = Buffer.from(raw, "base64");
    if (buffer.length === 0) return { photoUrl: null };

    const blob = await put(`meals/${userId}/${randomUUID()}.jpg`, buffer, {
      access: "public",
      contentType: "image/jpeg",
    });
    return { photoUrl: blob.url };
  } catch (error) {
    console.error("[calorAI] meal photo upload failed:", error);
    return { photoUrl: null };
  }
}

/**
 * NOTE: The Neon HTTP driver does not support interactive transactions
 * (`db.transaction` throws "No transactions support in neon-http driver").
 * Inserts below are therefore sequential; a failure mid-way can leave an
 * orphaned meal row without items.
 */
export async function saveMeal(input: SaveMealInput): Promise<{ mealId: string }> {
  const userId = await requireUserId();
  const data = saveMealInputSchema.parse(input);
  const eatenAt = parseEatenAt(data.eatenAt);

  const [meal] = await db
    .insert(meals)
    .values({
      userId,
      eatenAt,
      mealType: data.mealType,
      photoUrl: data.photoUrl,
      note: data.note,
    })
    .returning({ id: meals.id });

  await db.insert(foodItems).values(
    data.items.map((item) => ({
      mealId: meal.id,
      name: item.name,
      portionDescription: item.portionDescription,
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      confidence: null,
    })),
  );

  return { mealId: meal.id };
}

export async function updateMeal(input: UpdateMealInput): Promise<{ mealId: string }> {
  const userId = await requireUserId();
  const { mealId, ...rest } = input;
  const data = saveMealInputSchema.parse(rest);

  // Ownership check first — never update another user's meal.
  const [existing] = await db
    .select({ id: meals.id })
    .from(meals)
    .where(and(eq(meals.id, mealId), eq(meals.userId, userId)));
  if (!existing) throw new Error("MEAL_NOT_FOUND");

  await db
    .update(meals)
    .set({
      ...(data.eatenAt !== undefined ? { eatenAt: parseEatenAt(data.eatenAt) } : {}),
      mealType: data.mealType,
      ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(meals.id, mealId), eq(meals.userId, userId)));

  // Replace items wholesale (no transactions on neon-http).
  await db.delete(foodItems).where(eq(foodItems.mealId, mealId));
  await db.insert(foodItems).values(
    data.items.map((item) => ({
      mealId,
      name: item.name,
      portionDescription: item.portionDescription,
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      confidence: null,
    })),
  );

  return { mealId };
}

export async function deleteMeal(mealId: string): Promise<void> {
  const userId = await requireUserId();

  // food_items rows go away via ON DELETE CASCADE on meals.id.
  const deleted = await db
    .delete(meals)
    .where(and(eq(meals.id, mealId), eq(meals.userId, userId)))
    .returning({ id: meals.id });

  if (deleted.length === 0) throw new Error("MEAL_NOT_FOUND");
}
