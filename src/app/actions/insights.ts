"use server";

import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { foodItems, meals } from "@/db/schema";

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
// Local-day helpers. The whole app keys days by a plain 'YYYY-MM-DD' string
// in the user's local day; server actions resolve day boundaries in the
// server-local timezone exactly like getDay() does (`new Date('YYYY-MM-DD…')`).
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayLocalISO(): string {
  return toLocalISO(new Date());
}

/** Local-midnight Date for a 'YYYY-MM-DD' string. */
function startOfDay(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00`);
}

function addDaysISO(dateISO: string, days: number): string {
  return toLocalISO(new Date(startOfDay(dateISO).getTime() + days * DAY_MS));
}

type DayTotals = { kcal: number; proteinG: number; carbsG: number; fatG: number };

/**
 * Meals (with item nutrition) bucketed by local day between two exclusive
 * instants. Mirrors getDay()'s two-query shape (neon-http has no
 * transactions, but these are read-only anyway).
 */
async function loadMealsByDay(
  userId: string,
  start: Date,
  end: Date,
): Promise<Map<string, DayTotals>> {
  const byDay = new Map<string, DayTotals>();

  const rows = await db
    .select({ id: meals.id, eatenAt: meals.eatenAt })
    .from(meals)
    .where(and(eq(meals.userId, userId), gte(meals.eatenAt, start), lt(meals.eatenAt, end)));

  if (rows.length === 0) return byDay;

  // A meal counts toward a day as soon as it exists, even with no items yet.
  for (const row of rows) {
    byDay.set(toLocalISO(row.eatenAt), byDay.get(toLocalISO(row.eatenAt)) ?? {
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
  }

  const items = await db
    .select({
      mealId: foodItems.mealId,
      calories: foodItems.calories,
      proteinG: foodItems.proteinG,
      carbsG: foodItems.carbsG,
      fatG: foodItems.fatG,
    })
    .from(foodItems)
    .where(inArray(foodItems.mealId, rows.map((row) => row.id)));

  const mealIdToDay = new Map(rows.map((row) => [row.id, toLocalISO(row.eatenAt)]));
  for (const item of items) {
    const day = mealIdToDay.get(item.mealId);
    if (!day) continue;
    const totals = byDay.get(day);
    if (!totals) continue;
    totals.kcal += item.calories;
    totals.proteinG += item.proteinG;
    totals.carbsG += item.carbsG;
    totals.fatG += item.fatG;
  }

  return byDay;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Weekly rollup over the last 7 days including today (local days). */
export async function getWeeklyInsights(): Promise<{
  daysLogged: number;
  avgKcal: number;
  macroSplit: { proteinPct: number; carbsPct: number; fatPct: number };
  lowestDay: { dateISO: string; kcal: number } | null;
  highestDay: { dateISO: string; kcal: number } | null;
}> {
  const userId = await requireUserId();

  const today = todayLocalISO();
  const windowStart = addDaysISO(today, -6); // 7 days incl. today
  const start = startOfDay(windowStart);
  const end = startOfDay(addDaysISO(today, 1)); // exclusive

  const byDay = await loadMealsByDay(userId, start, end);

  const loggedDays = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  if (loggedDays.length === 0) {
    return {
      daysLogged: 0,
      avgKcal: 0,
      macroSplit: { proteinPct: 0, carbsPct: 0, fatPct: 0 },
      lowestDay: null,
      highestDay: null,
    };
  }

  let weekKcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  for (const [, totals] of loggedDays) {
    weekKcal += totals.kcal;
    proteinG += totals.proteinG;
    carbsG += totals.carbsG;
    fatG += totals.fatG;
  }

  const gramTotal = proteinG + carbsG + fatG;
  const pct = (grams: number) =>
    gramTotal > 0 ? Math.round((grams / gramTotal) * 100) : 0;

  let lowestDay: { dateISO: string; kcal: number } | null = null;
  let highestDay: { dateISO: string; kcal: number } | null = null;
  for (const [dateISO, totals] of loggedDays) {
    const entry = { dateISO, kcal: Math.round(totals.kcal) };
    if (!lowestDay || entry.kcal < lowestDay.kcal) lowestDay = entry;
    if (!highestDay || entry.kcal > highestDay.kcal) highestDay = entry;
  }

  return {
    daysLogged: loggedDays.length,
    avgKcal: Math.round(weekKcal / loggedDays.length),
    macroSplit: {
      proteinPct: pct(proteinG),
      carbsPct: pct(carbsG),
      fatPct: pct(fatG),
    },
    lowestDay,
    highestDay,
  };
}

/**
 * Logging streaks. A day qualifies as soon as ≥1 meal was logged — total
 * calories don't matter.
 */
export async function getStreak(): Promise<{ current: number; longest: number }> {
  const userId = await requireUserId();

  const byDay = await loadMealsByDay(
    userId,
    new Date(0), // full history — streaks are unbounded
    startOfDay(addDaysISO(todayLocalISO(), 1)),
  );

  if (byDay.size === 0) return { current: 0, longest: 0 };

  // Any day with at least one logged meal qualifies.
  const qualifying = [...byDay.keys()].sort((a, b) => a.localeCompare(b));

  // Longest run of consecutive qualifying days, ever.
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of qualifying) {
    run = prev !== null && addDaysISO(prev, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = day;
  }

  // Current streak ends today — or yesterday, so an unfinished today doesn't
  // wipe it. Today itself only counts once it actually qualifies.
  const set = new Set(qualifying);
  const today = todayLocalISO();
  const anchor = set.has(today) ? today : addDaysISO(today, -1);

  let current = 0;
  let cursor = anchor;
  while (set.has(cursor)) {
    current += 1;
    cursor = addDaysISO(cursor, -1);
  }

  return { current, longest };
}
