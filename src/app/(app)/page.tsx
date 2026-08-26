import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, Undo2Icon } from "lucide-react";

import { getGoals } from "@/app/actions/goals";
import { getDay, getRecentMeals } from "@/app/actions/meals";
import { getWaterForDate } from "@/app/actions/water";
import { getStreak, getWeeklyInsights } from "@/app/actions/insights";
import { CalorieRing } from "@/components/calorie-ring";
import { DateNavigator, DaySwipeRegion } from "@/components/date-navigator";
import { MacroBars } from "@/components/macro-bars";
import { StreakBadge } from "@/components/dashboard/streak-badge";
import { GoalCelebration } from "@/components/dashboard/goal-celebration";
import { WaterCard } from "@/components/dashboard/water-card";
import { RecentMealsStrip } from "@/components/dashboard/recent-meals-strip";
import { WeeklyInsightsCard } from "@/components/dashboard/weekly-insights-card";
import { Greeting } from "@/components/shared/greeting";
import { TopBar } from "@/components/top-bar";
import { DayEmptyState } from "@/components/meals/day-empty-state";
import { MealPhoto } from "@/components/meals/meal-photo";
import {
  isValidDateISO,
  formatTime,
  todayISO,
} from "@/components/shared/dates";
import { KcalText } from "@/components/shared/kcal-text";
import {
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
} from "@/components/shared/meal-types";
import type { MealEntry, MacroTotals } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Today",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await searchParams;
  const requested = resolved.date;
  const dateISO =
    typeof requested === "string" && isValidDateISO(requested)
      ? requested
      : todayISO();
  const today = todayISO();

  const isToday = dateISO === today;

  // Weekly insights are day-independent; water + recent meals only matter
  // for today (their cards render then). The streak is fetched once here and
  // shared by the badge and the celebration controller.
  const [day, goals, insights, waterTotalMl, recentMeals, streak] =
    await Promise.all([
      getDay(dateISO),
      getGoals(),
      getWeeklyInsights(),
      isToday ? getWaterForDate(today) : Promise.resolve(0),
      isToday ? getRecentMeals() : Promise.resolve([]),
      getStreak(),
    ]);

  return (
    <>
      <TopBar>
        <DateNavigator dateISO={dateISO} todayISO={today} />
        <Greeting />
      </TopBar>

      {dateISO !== today && (
        <div className="mx-auto w-full max-w-md px-4 pt-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-primary shadow-sm transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <Undo2Icon className="size-3.5" aria-hidden="true" />
            Back to today
          </Link>
        </div>
      )}

      <DaySwipeRegion dateISO={dateISO} todayISO={today}>
        <main className="mx-auto w-full max-w-md px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
          {/* Hero: ring + macros share one calm surface. Streak badge
              overlaps the top-right corner (renders nothing under 2 days).
              GoalCelebration wraps the ring: it mounts the once-a-day
              ring-close burst + arc glow, overlaying absolutely. */}
          <section
            aria-label="Daily progress"
            className="reveal relative rounded-3xl border bg-card p-5 pb-6 shadow-sm"
          >
            <StreakBadge current={streak.current} />
            <GoalCelebration
              consumed={day.totals.calories}
              goal={goals.calories}
              dateISO={dateISO}
              isToday={isToday}
              streak={streak.current}
            >
              <CalorieRing
                consumed={day.totals.calories}
                goal={goals.calories}
              />
            </GoalCelebration>
            <div className="mt-6 border-t border-border/60 pt-5">
              <MacroBars totals={day.totals} goals={goals} />
            </div>
          </section>

          {isToday && <RecentMealsStrip meals={recentMeals} />}

          {isToday && (
            <WaterCard
              dateISO={today}
              initialTotalMl={waterTotalMl}
              goalMl={goals.waterGoalMl}
            />
          )}

          {day.meals.length === 0 ? (
            <>
              {/* No meals: insights take the prime slot under the hero. */}
              <WeeklyInsightsCard insights={insights} />
              <DayEmptyState isToday={dateISO === today} />
            </>
          ) : (
            <>
              <section
                aria-label="Logged meals"
                className="reveal mt-7"
                style={{ animationDelay: "90ms" }}
              >
                <div className="flex items-center gap-2 px-1">
                  <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Meals
                  </h2>
                  <span className="tnum rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                    {day.meals.length} logged
                  </span>
                </div>

                <div className="mt-3 space-y-5">
                  {MEAL_TYPE_ORDER.map((type) => {
                    const meals = day.meals.filter((m) => m.mealType === type);
                    if (meals.length === 0) return null;
                    return (
                      <MealGroup key={type} type={type} meals={meals} dateISO={dateISO} />
                    );
                  })}
                </div>
              </section>

              <WeeklyInsightsCard insights={insights} />
            </>
          )}
        </main>
      </DaySwipeRegion>
    </>
  );
}

function MealGroup({
  type,
  meals,
  dateISO,
}: {
  type: MealEntry["mealType"];
  meals: MealEntry[];
  dateISO: string;
}) {
  const kcal = meals.reduce(
    (total, meal) =>
      total + meal.items.reduce((sum, item) => sum + item.calories, 0),
    0,
  );

  return (
    <div>
      <div className="flex items-baseline justify-between px-1.5">
        <h3 className="text-sm font-semibold">{MEAL_TYPE_LABELS[type]}</h3>
        {/* Client island so gentle mode can mask the subtotal pre-hydration-safe. */}
        <p className="tnum text-xs text-muted-foreground">
          <KcalText kcal={kcal} suffix=" kcal" />
        </p>
      </div>

      <ul
        role="list"
        className="mt-2 divide-y divide-border/70 overflow-hidden rounded-2xl border bg-card shadow-sm"
      >
        {meals.map((meal) => (
          <li key={meal.id}>
            <MealRow meal={meal} dateISO={dateISO} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MealRow({ meal, dateISO }: { meal: MealEntry; dateISO: string }) {
  const kcal = meal.items.reduce((sum, item) => sum + item.calories, 0);
  const firstName = meal.items[0]?.name ?? "Untitled item";
  const extraCount = Math.max(0, meal.items.length - 1);
  const totalsPreview: Pick<MacroTotals, "proteinG" | "carbsG" | "fatG"> = {
    proteinG: meal.items.reduce((s, i) => s + i.proteinG, 0),
    carbsG: meal.items.reduce((s, i) => s + i.carbsG, 0),
    fatG: meal.items.reduce((s, i) => s + i.fatG, 0),
  };

  return (
    <Link
      href={`/meal/${meal.id}?date=${dateISO}`}
      className="flex min-h-[4.5rem] items-center gap-3 px-3 py-3 transition-colors duration-150 hover:bg-muted/50 active:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <MealPhoto
        mealId={meal.id}
        photoUrl={meal.photoUrl}
        foodName={firstName}
        mealType={meal.mealType}
        className="size-11 shrink-0 rounded-xl text-lg ring-1 ring-border"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug">
          {firstName}
          {extraCount > 0 && (
            <span className="font-normal text-muted-foreground">
              {" "}
              +{extraCount} more
            </span>
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground tnum">
          {formatTime(meal.eatenAt)}
          {meal.note ? ` · ${meal.note}` : ""}
          {` · P ${Math.round(totalsPreview.proteinG)} C ${Math.round(totalsPreview.carbsG)} F ${Math.round(totalsPreview.fatG)}g`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <KcalText kcal={kcal} className="text-sm font-semibold" />
        <ChevronRightIcon
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
      </div>

      <span className="sr-only">kcal — open meal details</span>
    </Link>
  );
}
