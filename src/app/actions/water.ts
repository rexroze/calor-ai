"use server";

import { and, eq, sum } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { waterLogs } from "@/db/schema";

// ---------------------------------------------------------------------------
// Session helpers — same re-verification pattern as meals.ts/goals.ts.
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

/** Same plain local-day key the rest of the app uses ('YYYY-MM-DD'). */
const WATER_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Deltas are capped so a tap can't log absurd volumes; negative values are
 * allowed for undo. ±10L covers any realistic glass/bottle logging.
 */
const amountMlSchema = z.number().int().min(-10000).max(10000);

function assertValidDateISO(dateISO: string): void {
  if (!WATER_DATE_RE.test(dateISO)) throw new Error("INVALID_DATE");
}

/** Daily total in ml for a user+day; empty day sums to 0. */
async function totalForDate(userId: string, dateISO: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(waterLogs.amountMl) })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.dateISO, dateISO)));
  // Drizzle's sum() returns a string | null — normalize to number.
  const total = row?.total;
  return typeof total === "string" ? Number(total) : (total ?? 0);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Log a water delta (positive to add, negative to undo) for a local day and
 * return the new daily sum in ml.
 */
export async function logWater(
  dateISO: string,
  amountMl: number,
): Promise<{ totalMl: number }> {
  const userId = await requireUserId();
  assertValidDateISO(dateISO);
  const parsed = amountMlSchema.safeParse(amountMl);
  if (!parsed.success) throw new Error("INVALID_AMOUNT");

  await db.insert(waterLogs).values({
    userId,
    dateISO,
    amountMl: parsed.data,
  });

  revalidatePath("/");

  return { totalMl: await totalForDate(userId, dateISO) };
}

/** Summed milliliters logged for the user on a given local day. */
export async function getWaterForDate(dateISO: string): Promise<number> {
  const userId = await requireUserId();
  assertValidDateISO(dateISO);
  return totalForDate(userId, dateISO);
}
