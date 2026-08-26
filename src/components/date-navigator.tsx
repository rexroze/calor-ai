"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

import { addDaysISO } from "@/components/shared/dates";
import { CalendarSheet } from "@/components/shared/calendar-sheet";
import { cn } from "@/lib/utils";

const NAV_BTN =
  "flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[transform,color,background-color] duration-150 hover:bg-muted hover:text-foreground active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** "Tuesday, August 26" — the full date under the selected day. */
function formatFullDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

/**
 * Relative prefix for the hero title ("Today · ", "Yesterday · ").
 * Same comparisons formatDayLabel uses in shared/dates.
 */
function relativeDayPrefix(iso: string, todayIso: string): string {
  if (iso === todayIso) return "Today · ";
  if (iso === addDaysISO(todayIso, -1)) return "Yesterday · ";
  return "";
}

/** Client-side jump to a day; today collapses to the bare "/" route. */
function useGoToDate(todayIso: string) {
  const router = useRouter();
  return useCallback(
    (iso: string) => {
      router.push(iso === todayIso ? "/" : `/?date=${iso}`);
    },
    [router, todayIso],
  );
}

/**
 * Date-first dashboard header: chevrons flank a tappable hero title that
 * opens the calendar sheet. The future past today is not loggable, so
 * "next" goes dark once you reach today.
 */
export function DateNavigator({
  dateISO,
  todayISO: today,
}: {
  dateISO: string;
  todayISO: string;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const goToDate = useGoToDate(today);

  const prev = addDaysISO(dateISO, -1);
  const next = addDaysISO(dateISO, 1);
  const canGoNext = dateISO !== today;

  return (
    <>
      <div className="flex w-full items-center">
        <Link href={`/?date=${prev}`} aria-label="Previous day" className={NAV_BTN}>
          <ChevronLeftIcon className="size-5" aria-hidden="true" />
        </Link>

        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={calendarOpen}
          className="-my-1 min-w-0 flex-1 rounded-xl px-2 py-1 text-center leading-tight transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <span className="font-display block truncate text-lg font-semibold tracking-tight">
            {relativeDayPrefix(dateISO, today)}
            {formatFullDate(dateISO)}
          </span>
          <span className="mt-0.5 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <CalendarIcon className="size-3" aria-hidden="true" />
            Change date
          </span>
        </button>

        {canGoNext ? (
          <Link href={`/?date=${next}`} aria-label="Next day" className={NAV_BTN}>
            <ChevronRightIcon className="size-5" aria-hidden="true" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="Next day unavailable"
            className={cn(NAV_BTN, "pointer-events-none opacity-35")}
          >
            <ChevronRightIcon className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>

      <CalendarSheet
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        selectedISO={dateISO}
        onSelect={goToDate}
      />
    </>
  );
}

/** Horizontal distance (px) and dominance over vertical travel to count as a swipe. */
const SWIPE_THRESHOLD_PX = 50;

/** Elements a swipe must not originate on: controls and anything h-scrollable. */
function isSwipeExcluded(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (
    target.closest(
      "button, a, input, textarea, select, label, [role='button'], [data-no-swipe]",
    )
  ) {
    return true;
  }
  // Horizontally scrollable ancestors own horizontal gestures (carousels etc).
  let el: HTMLElement | null = target instanceof HTMLElement ? target : null;
  while (el && el !== document.body) {
    if (
      el.scrollWidth > el.clientWidth + 1 &&
      /(auto|scroll)/.test(getComputedStyle(el).overflowX)
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [contenteditable='']",
    ),
  );
}

function hasOpenDialog(): boolean {
  // Radix dialogs render role="dialog"; alert dialogs role="alertdialog".
  return Boolean(
    document.querySelector(
      "[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open']",
    ),
  );
}

/**
 * Wraps the scrollable dashboard content and turns horizontal drags into
 * prev/next-day navigation. Vertical scrolling is never blocked:
 * `touch-action: pan-y` leaves vertical pans to the browser (we get
 * pointercancel), and we never preventDefault on move events.
 */
export function DaySwipeRegion({
  dateISO,
  todayISO: today,
  children,
  className,
}: {
  dateISO: string;
  todayISO: string;
  children: React.ReactNode;
  className?: string;
}) {
  const gestureStart = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );
  const goToDate = useGoToDate(today);

  const goPrev = useCallback(() => goToDate(addDaysISO(dateISO, -1)), [
    goToDate,
    dateISO,
  ]);
  const goNext = useCallback(() => {
    if (dateISO !== today) goToDate(addDaysISO(dateISO, 1));
  }, [goToDate, dateISO, today]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (isSwipeExcluded(event.target)) {
      gestureStart.current = null;
      return;
    }
    gestureStart.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
  }

  function endGesture(event: React.PointerEvent<HTMLDivElement>, commit: boolean) {
    const start = gestureStart.current;
    gestureStart.current = null;
    if (!commit || !start || event.pointerId !== start.pointerId) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dy) < Math.abs(dx)) {
      if (dx < 0) goNext();
      else goPrev();
    }
  }

  // Arrow keys mirror swipes; skipped while typing or when any dialog is open.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }
      if (isTypingTarget(event.target) || hasOpenDialog()) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext]);

  return (
    <div
      className={cn("touch-pan-y", className)}
      onPointerDown={handlePointerDown}
      onPointerUp={(event) => endGesture(event, true)}
      onPointerCancel={(event) => endGesture(event, false)}
    >
      {children}
    </div>
  );
}
