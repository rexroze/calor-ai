import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, CalendarSearchIcon } from "lucide-react";

import { getDay } from "@/app/actions/meals";
import { MealEditor } from "@/components/meals/meal-editor";
import { isValidDateISO } from "@/components/shared/dates";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Meal details",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Focus-mode detail/edit screen. The Today list always links here with
 * ?date=YYYY-MM-DD; without that context we can't look the meal up (there is
 * no by-id fetch), so we show a friendly way back instead.
 */
export default async function MealPage({ params, searchParams }: PageProps) {
  const [{ id }, resolvedSearch] = await Promise.all([params, searchParams]);
  const dateParam = resolvedSearch.date;
  const dateISO =
    typeof dateParam === "string" && isValidDateISO(dateParam)
      ? dateParam
      : undefined;

  return (
    <div className="relative min-h-dvh">
      <div className="app-backdrop" aria-hidden="true" />

      <TopBar>
        <Link
          href={dateISO ? `/?date=${dateISO}` : "/"}
          aria-label="Back"
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeftIcon className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="flex-1 text-center font-display text-lg font-semibold tracking-tight">
          Meal details
        </h1>
        {/* Balances the back button so the title stays optically centered. */}
        <span aria-hidden="true" className="size-11 shrink-0" />
      </TopBar>

      {!dateISO ? (
        <MissingDateNotice />
      ) : (
        <MealDetail dateISO={dateISO} mealId={id} />
      )}
    </div>
  );
}

async function MealDetail({
  dateISO,
  mealId,
}: {
  dateISO: string;
  mealId: string;
}) {
  const day = await getDay(dateISO);
  const meal = day.meals.find((entry) => entry.id === mealId);

  if (!meal) {
    return <NotInDayNotice dateISO={dateISO} />;
  }

  return (
    <MealEditor
      key={`${meal.id}:${day.totals.calories}`}
      dateISO={dateISO}
      meal={meal}
    />
  );
}

function MissingDateNotice() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-safe">
      <div className="reveal mt-6 rounded-3xl border bg-card p-8 text-center shadow-sm">
        <CalendarSearchIcon
          aria-hidden="true"
          className="mx-auto size-10 text-muted-foreground"
          strokeWidth={1.6}
        />
        <h2 className="font-display mt-4 text-lg font-semibold tracking-tight">
          Which day was this on?
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          This link is missing the day it belongs to, so the meal can&apos;t be
          looked up. Pick the day from your diary and open it from there.
        </p>
        <Button asChild size="lg" className="mt-5 h-11 px-6">
          <Link href="/">Back to today</Link>
        </Button>
      </div>
    </main>
  );
}

function NotInDayNotice({ dateISO }: { dateISO: string }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-safe">
      <div className="reveal mt-6 rounded-3xl border bg-card p-8 text-center shadow-sm">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          No meal here
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          This meal isn&apos;t logged on{" "}
          <span className="tnum font-medium text-foreground">{dateISO}</span>.
          It may have been removed or edited from another device.
        </p>
        <Button asChild size="lg" className="mt-5 h-11 px-6">
          <Link href={`/?date=${dateISO}`}>Open the day</Link>
        </Button>
      </div>
    </main>
  );
}
