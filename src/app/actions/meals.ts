"use server";

import { del, put } from "@vercel/blob";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
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
  type FoodItemInput,
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
 * Persist a meal photo to Vercel Blob and attach it to the meal
 * (`meals.photo_url`), returning the public URL.
 *
 * Never throws for storage problems: without BLOB_READ_WRITE_TOKEN (local dev)
 * this is a graceful no-op, and any upload failure degrades to a photoless
 * meal instead of blocking the log. Only an expired/missing session throws.
 */
export async function uploadMealPhoto(
  base64Jpeg: string,
  mealId: string,
): Promise<{ photoUrl: string | null }> {
  const userId = await requireUserId();

  // Ownership first — never attach a photo to (or store blobs for) another
  // user's meal id.
  const [meal] = await db
    .select({ id: meals.id })
    .from(meals)
    .where(and(eq(meals.id, mealId), eq(meals.userId, userId)));
  if (!meal) return { photoUrl: null };

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
    await db
      .update(meals)
      .set({ photoUrl: blob.url, updatedAt: new Date() })
      .where(and(eq(meals.id, mealId), eq(meals.userId, userId)));
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

  // Capture the photo URL before the row (and its photo_url) is gone.
  const [existing] = await db
    .select({ photoUrl: meals.photoUrl })
    .from(meals)
    .where(and(eq(meals.id, mealId), eq(meals.userId, userId)));

  // food_items rows go away via ON DELETE CASCADE on meals.id.
  const deleted = await db
    .delete(meals)
    .where(and(eq(meals.id, mealId), eq(meals.userId, userId)))
    .returning({ id: meals.id });

  if (deleted.length === 0) throw new Error("MEAL_NOT_FOUND");

  // Best-effort blob cleanup — a failed delete must never block removing the
  // meal from the diary.
  if (existing?.photoUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(existing.photoUrl);
    } catch (error) {
      console.error("[calorAI] meal photo blob delete failed:", error);
    }
  }
}

// ---------------------------------------------------------------------------
// Recent meals (dashboard re-log strip)
// ---------------------------------------------------------------------------

/**
 * A deduplicated recent meal for the dashboard re-log strip. Type-only
 * export — erased at runtime, so it respects the "use server"
 * async-functions-only rule.
 */
export type RecentMeal = {
  id: string;
  /** Display name: the first item's original-cased name. */
  name: string;
  mealType: MealEntry["mealType"];
  photoUrl: string | null;
  /** Items in SaveMealInput shape (no ids) — ready to clone-log as-is. */
  items: FoodItemInput[];
  totalKcal: number;
};

/**
 * Distinct recently-logged meals, most recent first, for one-tap re-logging.
 *
 * Dedupe rule: signature = `${first item's name trimmed + lowercased}#${total
 * kcal bucketed to the nearest 100}` — e.g. "chicken salad#4". The first
 * occurrence wins (i.e. the newest instance of a repeated dish); later meals
 * with the same signature are skipped.
 *
 * Fetches the last 40 meals (bounded query) plus their items, then dedupes
 * in memory — same two-query shape as getDay() (neon-http, no transactions).
 */
export async function getRecentMeals(limit = 6): Promise<RecentMeal[]> {
  const userId = await requireUserId();

  const recentMeals = await db
    .select()
    .from(meals)
    .where(eq(meals.userId, userId))
    .orderBy(desc(meals.eatenAt))
    .limit(40);

  if (recentMeals.length === 0) return [];

  const itemsByMealId = new Map<string, FoodItemEntry[]>();
  const items = await db
    .select()
    .from(foodItems)
    .where(inArray(foodItems.mealId, recentMeals.map((meal) => meal.id)))
    .orderBy(asc(foodItems.id));
  for (const item of items) {
    const list = itemsByMealId.get(item.mealId) ?? [];
    list.push(item);
    itemsByMealId.set(item.mealId, list);
  }

  const seen = new Set<string>();
  const result: RecentMeal[] = [];
  for (const meal of recentMeals) {
    if (result.length >= limit) break;

    const mealItems = itemsByMealId.get(meal.id);
    if (!mealItems || mealItems.length === 0) continue;

    const totalKcal = Math.round(
      mealItems.reduce((sum, item) => sum + item.calories, 0),
    );
    const firstName = mealItems[0].name.trim().toLowerCase();
    const kcalBucket = Math.round(totalKcal / 100);
    const signature = `${firstName}#${kcalBucket}`;
    if (seen.has(signature)) continue;
    seen.add(signature);

    result.push({
      id: meal.id,
      name: mealItems[0].name,
      mealType: meal.mealType as MealEntry["mealType"],
      photoUrl: meal.photoUrl,
      items: mealItems.map((item) => ({
        name: item.name,
        portionDescription: item.portionDescription,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
      })),
      totalKcal,
    });
  }

  return result;
}
