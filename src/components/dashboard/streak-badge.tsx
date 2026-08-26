import { FlameIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Current-streak pill overlapping the hero card's top-right corner.
 * Renders NOTHING below a 2-day streak — never shame (product decision).
 * The streak is fetched once by the Today page and passed down (shared with
 * the GoalCelebration controller), so this stays a plain server-rendered leaf.
 */
export function StreakBadge({
  current,
  className,
}: {
  current: number;
  className?: string;
}) {
  if (current < 2) return null;

  return (
    <span
      className={cn(
        "absolute -top-3 right-4 z-10 inline-flex min-h-7 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary shadow-sm",
        className,
      )}
    >
      <FlameIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="tnum whitespace-nowrap">{current}-day streak</span>
    </span>
  );
}
