"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { saveMeal, type RecentMeal } from "@/app/actions/meals";
import { MealPhoto } from "@/components/meals/meal-photo";
import { formatKcal } from "@/components/shared/format";

/**
 * Horizontal chip row of distinct recent meals (today only). Tapping a chip
 * clone-logs it right now — new meal id server-side, eatenAt = now,
 * note "Re-logged" — with a toast; no navigation away.
 *
 * The row is horizontally scrollable: `data-no-swipe` plus the scrollable-
 * ancestor check in DaySwipeRegion keep day-swiping from hijacking it.
 */
export function RecentMealsStrip({ meals }: { meals: RecentMeal[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function relog(meal: RecentMeal) {
    if (pendingId) return;
    setPendingId(meal.id);
    try {
      await saveMeal({
        eatenAt: new Date().toISOString(),
        mealType: meal.mealType,
        note: "Re-logged",
        photoUrl: meal.photoUrl ?? undefined,
        items: meal.items,
      });
      toast.success(`Logged ${meal.name}`);
      router.refresh();
    } catch {
      toast.error("Couldn't log that meal. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  if (meals.length === 0) return null;

  return (
    <section
      aria-label="Recently logged meals"
      className="reveal mt-5"
      style={{ animationDelay: "45ms" }}
    >
      <h2 className="px-1 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Recent
      </h2>

      <ul
        role="list"
        data-no-swipe
        className="-mx-4 mt-2.5 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {meals.map((meal) => (
          <li key={meal.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => void relog(meal)}
              disabled={pendingId !== null}
              aria-label={`Log ${meal.name} again now, about ${formatKcal(meal.totalKcal)} calories`}
              className="flex min-h-11 items-center gap-2 rounded-2xl border bg-card py-1.5 pl-1.5 pr-3 shadow-sm transition-colors duration-150 hover:bg-muted/50 active:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-60"
            >
              <MealPhoto
                mealId={meal.id}
                photoUrl={meal.photoUrl}
                foodName={meal.name}
                mealType={meal.mealType}
                className="size-8 shrink-0 rounded-lg text-base ring-1 ring-border"
              />
              <span className="max-w-[8.5rem] truncate text-sm font-medium">
                {meal.name}
              </span>
              {pendingId === meal.id ? (
                <LoaderCircleIcon
                  className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <span className="tnum shrink-0 text-xs text-muted-foreground">
                  {formatKcal(meal.totalKcal)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
