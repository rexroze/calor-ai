"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import type { Goals } from "@/lib/contracts";
import { db } from "@/db";
import { goals } from "@/db/schema";

// Not exported: "use server" modules may only export async functions.
const DEFAULT_GOALS: Goals = {
  calories: 2000,
  proteinG: 150,
  carbsG: 220,
  fatG: 65,
};

/** Daily water target fallback when the column is null/unset. */
const DEFAULT_WATER_GOAL_ML = 2000;

/**
 * Goals plus the water target. Type-only export — erased at runtime, so it
 * respects the "use server" async-functions-only rule.
 */
export type GoalsWithWater = Goals & { waterGoalMl: number };

const goalsInputSchema = z.object({
  calories: z.number().int().min(0).max(20000),
  proteinG: z.number().int().min(0).max(2000),
  carbsG: z.number().int().min(0).max(4000),
  fatG: z.number().int().min(0).max(2000),
});

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user.id;
}

/** Returns the stored goals or sensible defaults — never creates a row. */
export async function getGoals(): Promise<GoalsWithWater> {
  const userId = await requireUserId();

  const [row] = await db
    .select({
      calories: goals.calories,
      proteinG: goals.proteinG,
      carbsG: goals.carbsG,
      fatG: goals.fatG,
      waterGoalMl: goals.waterGoalMl,
    })
    .from(goals)
    .where(eq(goals.userId, userId));

  // Pre-migration rows (and the defaults path) fall back to 2000 ml.
  return {
    ...(row ?? DEFAULT_GOALS),
    waterGoalMl: row?.waterGoalMl ?? DEFAULT_WATER_GOAL_ML,
  };
}

/** Upserts the user's daily macro goals. */
export async function saveGoals(input: Goals): Promise<void> {
  const userId = await requireUserId();
  const data = goalsInputSchema.parse(input);

  await db
    .insert(goals)
    .values({ userId, ...data })
    .onConflictDoUpdate({
      target: goals.userId,
      set: { ...data, updatedAt: new Date() },
    });
}
