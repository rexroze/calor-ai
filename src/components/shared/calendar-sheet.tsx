"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { todayISO, toISODate } from "@/components/shared/dates";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type Month = { year: number; month: number }; // month: 0-indexed

function monthOf(iso: string): Month {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? monthOf(todayISO())
    : { year: d.getFullYear(), month: d.getMonth() };
}

function shiftMonth({ year, month }: Month, delta: number): Month {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

const MONTH_BTN =
  "flex size-9 items-center justify-center rounded-full text-muted-foreground transition-[transform,color,background-color] duration-150 hover:bg-muted hover:text-foreground active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-35";

/**
 * Bottom-sheet month picker for the date navigator. Works on local-day
 * `YYYY-MM-DD` strings; future dates are disabled — you can't log ahead.
 * Open state is controlled by the caller; selecting a day reports it via
 * `onSelect` and requests close.
 *
 * Radix unmounts the content while closed, so the grid below mounts fresh
 * on every open — its view state always re-initializes on the selected
 * day's month without effects.
 */
export function CalendarSheet({
  open,
  onOpenChange,
  selectedISO,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedISO: string;
  onSelect: (iso: string) => void;
}) {
  function handlePick(iso: string) {
    onSelect(iso);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
            Pick a date
          </SheetTitle>
          <SheetDescription>Jump back to any past day.</SheetDescription>
        </SheetHeader>

        <MonthGrid selectedISO={selectedISO} onPick={handlePick} />
      </SheetContent>
    </Sheet>
  );
}

function MonthGrid({
  selectedISO,
  onPick,
}: {
  selectedISO: string;
  onPick: (iso: string) => void;
}) {
  const [view, setView] = useState<Month>(() => monthOf(selectedISO));

  const today = todayISO();
  const currentMonth = monthOf(today);
  const canGoNext =
    view.year * 12 + view.month < currentMonth.year * 12 + currentMonth.month;

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const monthTitle = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(view.year, view.month, 1));

  return (
    <>
      <div className="flex items-center justify-between px-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setView((m) => shiftMonth(m, -1))}
          className={MONTH_BTN}
        >
          <ChevronLeftIcon className="size-5" aria-hidden="true" />
        </button>
        <p
          aria-live="polite"
          className="font-display text-sm font-semibold tracking-tight"
        >
          {monthTitle}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setView((m) => shiftMonth(m, 1))}
          disabled={!canGoNext}
          className={MONTH_BTN}
        >
          <ChevronRightIcon className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div
        role="grid"
        aria-label={monthTitle}
        className="grid grid-cols-7 gap-y-1 px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      >
        {WEEKDAYS.map((day) => (
          <span
            key={day}
            aria-hidden="true"
            className="grid h-8 place-items-center text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase"
          >
            {day}
          </span>
        ))}

        {Array.from({ length: firstWeekday }).map((_, i) => (
          <span key={`pad-${i}`} aria-hidden="true" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const iso = toISODate(new Date(view.year, view.month, day));
          const disabled = iso > today;
          const selected = iso === selectedISO;
          const isToday = iso === today;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              disabled={disabled}
              aria-label={`${iso}${selected ? " (selected)" : ""}`}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "tnum mx-auto grid size-9 place-items-center rounded-full text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                selected
                  ? "bg-primary font-semibold text-primary-foreground"
                  : isToday
                    ? "text-primary hover:bg-muted"
                    : "hover:bg-muted disabled:pointer-events-none disabled:opacity-30",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </>
  );
}
