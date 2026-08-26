"use client";

import { useState } from "react";
import { LeafIcon, TrendingUpIcon } from "lucide-react";

import { formatDayLabel, todayISO } from "@/components/shared/dates";
import { useGentle } from "@/components/shared/preferences";
import { formatKcal } from "@/components/shared/format";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Mirrors getWeeklyInsights()' return shape (kept local to avoid coupling). */
export type WeeklyInsightsData = {
  daysLogged: number;
  avgKcal: number;
  macroSplit: { proteinPct: number; carbsPct: number; fatPct: number };
  lowestDay: { dateISO: string; kcal: number } | null;
  highestDay: { dateISO: string; kcal: number } | null;
};

const SEGMENTS = [
  { key: "proteinPct", label: "Protein", barClass: "bg-protein" },
  { key: "carbsPct", label: "Carbs", barClass: "bg-carbs" },
  { key: "fatPct", label: "Fat", barClass: "bg-fat" },
] as const;

/**
 * Weekly rollup teaser card; tapping opens a bottom-sheet breakdown.
 * Renders NOTHING when daysLogged === 0. Data is fetched server-side and
 * passed down — this island is presentation + sheet state only.
 */
export function WeeklyInsightsCard({ insights }: { insights: WeeklyInsightsData }) {
  const [open, setOpen] = useState(false);
  // Gentle mode: headline keeps only "N days logged"; the sheet drops its
  // kcal rows (macro-split percentages aren't calories and stay).
  const [gentle] = useGentle();

  // Empty guard: no logged days this week ⇒ no card at all.
  if (insights.daysLogged === 0) return null;

  const today = todayISO();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="reveal mt-5 block w-full rounded-3xl border bg-card p-5 pb-6 text-left shadow-sm transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        style={{ animationDelay: "150ms" }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            This week
          </h2>
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-primary/60"
          />
        </div>

        <p className="tnum mt-3 text-lg font-semibold tracking-tight">
          {gentle ? (
            <>
              {insights.daysLogged}{" "}
              {insights.daysLogged === 1 ? "day" : "days"} logged
            </>
          ) : (
            <>
              ~{formatKcal(insights.avgKcal)} kcal
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {insights.daysLogged}{" "}
                {insights.daysLogged === 1 ? "day" : "days"} logged
              </span>
            </>
          )}
        </p>

        {/* Macro split: only >0% segments render, so zero segments vanish;
            minWidth keeps real slivers visible inside the rounded track. */}
        <div className="mt-3.5 flex h-2.5 overflow-hidden rounded-full bg-muted">
          {SEGMENTS.map(
            (segment) =>
              insights.macroSplit[segment.key] > 0 && (
                <span
                  key={segment.key}
                  className={cn("h-full", segment.barClass)}
                  style={{
                    width: `${insights.macroSplit[segment.key]}%`,
                    minWidth: "6%",
                  }}
                />
              ),
          )}
        </div>
        <span className="sr-only">
          Macro split: protein {insights.macroSplit.proteinPct}%, carbs{" "}
          {insights.macroSplit.carbsPct}%, fat {insights.macroSplit.fatPct}%
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-md rounded-t-3xl"
        >
          <span
            aria-hidden="true"
            className="mx-auto mt-1 h-1 w-10 shrink-0 rounded-full bg-border"
          />

          <SheetHeader className="px-5">
            <SheetTitle className="font-display font-semibold tracking-tight">
              This week
            </SheetTitle>
            <SheetDescription>
              Last 7 days including today.
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            <dl className="divide-y divide-border/70 rounded-2xl border bg-card shadow-sm">
              {/* Average intake is a calorie figure — hidden entirely in gentle mode. */}
              {!gentle && (
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <dt className="text-sm font-medium">Average intake</dt>
                  <dd className="tnum text-sm font-semibold">
                    ~{formatKcal(insights.avgKcal)} kcal
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {insights.daysLogged}{" "}
                      {insights.daysLogged === 1 ? "day" : "days"}
                    </span>
                  </dd>
                </div>
              )}

              <div className="px-4 py-3.5">
                <dt className="text-sm font-medium">Macro split</dt>
                <dd className="mt-2.5 space-y-2">
                  {SEGMENTS.map((segment) => (
                    <div
                      key={segment.key}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            segment.barClass,
                          )}
                        />
                        {segment.label}
                      </span>
                      <span className="tnum text-sm font-medium">
                        {insights.macroSplit[segment.key]}%
                      </span>
                    </div>
                  ))}
                </dd>
              </div>

              {insights.lowestDay && (
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <dt className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <LeafIcon
                      className="size-4 shrink-0 text-protein"
                      aria-hidden="true"
                    />
                    Lightest day
                  </dt>
                  <dd className="tnum truncate text-sm">
                    <span className="text-muted-foreground">
                      {formatDayLabel(insights.lowestDay.dateISO, today)}
                    </span>
                    {!gentle && (
                      <>
                        <span className="ml-1.5 font-semibold">
                          {formatKcal(insights.lowestDay.kcal)}
                        </span>
                        <span className="ml-1 text-muted-foreground">kcal</span>
                      </>
                    )}
                  </dd>
                </div>
              )}

              {insights.highestDay && (
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <dt className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <TrendingUpIcon
                      className="size-4 shrink-0 text-carbs"
                      aria-hidden="true"
                    />
                    Biggest day
                  </dt>
                  <dd className="tnum truncate text-sm">
                    <span className="text-muted-foreground">
                      {formatDayLabel(insights.highestDay.dateISO, today)}
                    </span>
                    {!gentle && (
                      <>
                        <span className="ml-1.5 font-semibold">
                          {formatKcal(insights.highestDay.kcal)}
                        </span>
                        <span className="ml-1 text-muted-foreground">kcal</span>
                      </>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
