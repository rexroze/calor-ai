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
export async function getGoals(): Promise<Goals> {
  const userId = await requireUserId();

  const [row] = await db
    .select({
      calories: goals.calories,
      proteinG: goals.proteinG,
      carbsG: goals.carbsG,
      fatG: goals.fatG,
    })
    .from(goals)
    .where(eq(goals.userId, userId));

  return row ?? DEFAULT_GOALS;
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
