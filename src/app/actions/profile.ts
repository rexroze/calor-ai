"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { goals, profile } from "@/db/schema";
import { computeTargets, type ActivityLevel, type GoalIntent, type Sex } from "@/lib/targets";

// ---------------------------------------------------------------------------
// Auth helper (identical pattern to goals.ts)
// ---------------------------------------------------------------------------

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user.id;
}

// ---------------------------------------------------------------------------
// Profile data types
// ---------------------------------------------------------------------------

export type ProfileData = {
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  goalIntent: GoalIntent | null;
  unitPreference: "metric" | "imperial";
};

/** Input type — `unitPreference` is optional (defaults to "metric"). */
export type ProfileInput = Omit<ProfileData, "unitPreference"> & {
  unitPreference?: "metric" | "imperial";
};

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const profileInputSchema = z.object({
  sex: z.enum(["male", "female"]).nullable().default(null),
  age: z.number().int().min(13).max(99).nullable().default(null),
  heightCm: z.number().min(50).max(300).nullable().default(null),
  weightKg: z.number().min(20).max(500).nullable().default(null),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active"]).nullable().default(null),
  goalIntent: z.enum(["lose", "maintain", "gain"]).nullable().default(null),
  unitPreference: z.enum(["metric", "imperial"]).default("metric"),
});

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

/** Returns the stored profile or empty defaults — never creates a row. */
export async function getProfile(): Promise<ProfileData> {
  const userId = await requireUserId();

  const [row] = await db
    .select({
      sex: profile.sex,
      age: profile.age,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      activityLevel: profile.activityLevel,
      goalIntent: profile.goalIntent,
      unitPreference: profile.unitPreference,
    })
    .from(profile)
    .where(eq(profile.userId, userId));

  return {
    sex: row?.sex as Sex | null ?? null,
    age: row?.age ?? null,
    heightCm: row?.heightCm ?? null,
    weightKg: row?.weightKg ?? null,
    activityLevel: row?.activityLevel as ActivityLevel | null ?? null,
    goalIntent: row?.goalIntent as GoalIntent | null ?? null,
    unitPreference: (row?.unitPreference as "metric" | "imperial") ?? "metric",
  };
}

/** Upserts the user's profile data. */
export async function saveProfile(data: ProfileInput): Promise<void> {
  const userId = await requireUserId();
  const parsed = profileInputSchema.parse(data);

  await db
    .insert(profile)
    .values({
      userId,
      sex: parsed.sex,
      age: parsed.age,
      heightCm: parsed.heightCm,
      weightKg: parsed.weightKg,
      activityLevel: parsed.activityLevel,
      goalIntent: parsed.goalIntent,
      unitPreference: parsed.unitPreference,
    })
    .onConflictDoUpdate({
      target: profile.userId,
      set: {
        sex: parsed.sex,
        age: parsed.age,
        heightCm: parsed.heightCm,
        weightKg: parsed.weightKg,
        activityLevel: parsed.activityLevel,
        goalIntent: parsed.goalIntent,
        unitPreference: parsed.unitPreference,
        updatedAt: new Date(),
      },
    });
}

/**
 * Reads the saved profile, recomputes calorie/macro targets via
 * `computeTargets()`, and upserts the result into the goals table.
 * Returns the newly computed goals so the caller can refresh.
 */
export async function recalculateTargets(): Promise<{
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}> {
  const userId = await requireUserId();

  // Fetch profile
  const [row] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, userId));

  if (!row) {
    throw new Error("Please save your profile first before recalculating targets.");
  }
  if (!row.sex || !row.age || !row.heightCm || !row.weightKg || !row.activityLevel || !row.goalIntent) {
    throw new Error("Please fill in all profile fields (sex, age, height, weight, activity level, and goal) before recalculating.");
  }

  const targets = computeTargets({
    sex: row.sex as Sex,
    age: row.age,
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    activity: row.activityLevel as ActivityLevel,
    intent: row.goalIntent as GoalIntent,
  });

  // Upsert into goals table
  await db
    .insert(goals)
    .values({
      userId,
      calories: targets.calories,
      proteinG: targets.proteinG,
      carbsG: targets.carbsG,
      fatG: targets.fatG,
    })
    .onConflictDoUpdate({
      target: goals.userId,
      set: {
        calories: targets.calories,
        proteinG: targets.proteinG,
        carbsG: targets.carbsG,
        fatG: targets.fatG,
        updatedAt: new Date(),
      },
    });

  return {
    calories: targets.calories,
    proteinG: targets.proteinG,
    carbsG: targets.carbsG,
    fatG: targets.fatG,
  };
}
