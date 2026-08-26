import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  addDaysISO,
  formatDayLabel,
} from "@/components/shared/dates";
import { cn } from "@/lib/utils";

const NAV_BTN =
  "flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[transform,color,background-color] duration-150 hover:bg-muted hover:text-foreground active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Yesterday | labeled day | tomorrow. The future past today is not
 * loggable, so "next" goes dark once you reach today. On today the center
 * slot can be overridden (e.g. a personalized greeting) while both
 * chevrons keep their places.
 */
export function DateNavigator({
  dateISO,
  todayISO: today,
  center,
}: {
  dateISO: string;
  todayISO: string;
  /** Replaces the day label — only honored on today (past days stay dates). */
  center?: ReactNode;
}) {
  const prev = addDaysISO(dateISO, -1);
  const next = addDaysISO(dateISO, 1);
  const isToday = dateISO === today;
  const canGoNext = !isToday;

  return (
    <div className="flex w-full items-center">
      <Link href={`/?date=${prev}`} aria-label="Previous day" className={NAV_BTN}>
        <ChevronLeftIcon className="size-5" aria-hidden="true" />
      </Link>

      <div className="min-w-0 flex-1 text-center leading-tight">
        {isToday && center ? (
          center
        ) : (
          <>
            <p className="font-display truncate text-lg font-semibold tracking-tight">
              {formatDayLabel(dateISO, today)}
            </p>
            {!isToday && (
              <p className="text-xs text-muted-foreground">
                {formatFullDate(dateISO)}
              </p>
            )}
          </>
        )}
      </div>

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
  );
}

function formatFullDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}
