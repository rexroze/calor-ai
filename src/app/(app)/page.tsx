import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { getGoals } from "@/app/actions/goals";
import { getDay } from "@/app/actions/meals";
import { CalorieRing } from "@/components/calorie-ring";
import { DateNavigator } from "@/components/date-navigator";
import { Greeting } from "@/components/shared/greeting";
import { MacroBars } from "@/components/macro-bars";
import { TopBar } from "@/components/top-bar";
import { DayEmptyState } from "@/components/meals/day-empty-state";
import { MEAL_TYPE_ICONS } from "@/components/meals/meal-type-icons";
import {
  isValidDateISO,
  formatTime,
  todayISO,
} from "@/components/shared/dates";
import { formatKcal } from "@/components/shared/format";
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

  const [day, goals] = await Promise.all([getDay(dateISO), getGoals()]);

  return (
    <>
      <TopBar>
        <DateNavigator
          dateISO={dateISO}
          todayISO={today}
          center={dateISO === today ? <Greeting /> : undefined}
        />
      </TopBar>

      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
        {/* Hero: ring + macros share one calm surface. */}
        <section
          aria-label="Daily progress"
          className="reveal rounded-3xl border bg-card p-5 pb-6 shadow-sm"
        >
          <CalorieRing consumed={day.totals.calories} goal={goals.calories} />
          <div className="mt-6 border-t border-border/60 pt-5">
            <MacroBars totals={day.totals} goals={goals} />
          </div>
        </section>

        {day.meals.length === 0 ? (
          <DayEmptyState isToday={dateISO === today} />
        ) : (
          <section
            aria-label="Logged meals"
            className="reveal mt-7"
            style={{ animationDelay: "90ms" }}
          >
            <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Meals
              <span className="tnum ml-2 font-medium normal-case">
                {day.meals.length === 1
                  ? "1 logged"
                  : `${day.meals.length} logged`}
              </span>
            </h2>

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
        )}
      </main>
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
        <p className="tnum text-xs text-muted-foreground">
          {formatKcal(kcal)} kcal
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
  const Icon = MEAL_TYPE_ICONS[meal.mealType];
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
      {meal.photoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={meal.photoUrl}
          alt=""
          className="size-11 shrink-0 rounded-xl object-cover ring-1 ring-border"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/60 text-accent-foreground [&_svg]:size-5"
        >
          <Icon strokeWidth={2} />
        </span>
      )}

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
        <span className="tnum text-sm font-semibold">{formatKcal(kcal)}</span>
        <ChevronRightIcon
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
      </div>

      <span className="sr-only">kcal — open meal details</span>
    </Link>
  );
}
