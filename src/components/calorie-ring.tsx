"use client";

import { useEnterProgress } from "@/components/shared/use-enter-progress";
import { useGentle } from "@/components/shared/preferences";
import { useRingCelebration } from "@/components/dashboard/goal-celebration";
import { formatKcal } from "@/components/shared/format";
import { cn } from "@/lib/utils";

const SIZE = 224;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The hero of the Today screen: calories consumed vs. daily goal,
 * with the big confident number living in the center.
 * One flat coral arc — no gradients, no glow; the number is the hero.
 * Sole exception: the ephemeral once-a-day ring-close pulse from
 * GoalCelebration (a brief drop-shadow breath on the arc, ~1.6s).
 */
export function CalorieRing({
  consumed,
  goal,
}: {
  consumed: number;
  goal: number;
}) {
  const hasGoal = goal > 0;
  const rawRatio = hasGoal ? consumed / goal : 0;
  const ratio = useEnterProgress(rawRatio);
  const celebrating = useRingCelebration();
  const offset = CIRCUMFERENCE * (1 - ratio);

  // Gentle mode: the hero number becomes "% of goal consumed" (no-goal case
  // degrades to a muted placeholder). The aria-label below always keeps the
  // real figures so screen readers stay truthful either way.
  const [gentle] = useGentle();

  const remaining = Math.round(goal - consumed);
  const over = remaining < 0;

  return (
    <div
      role="img"
      aria-label={
        hasGoal
          ? `Consumed ${formatKcal(consumed)} of ${formatKcal(goal)} kilocalories`
          : `Consumed ${formatKcal(consumed)} kilocalories`
      }
      className="relative mx-auto"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            over ? "stroke-destructive" : "stroke-primary",
            celebrating && "animate-ring-glow",
          )}
        />
      </svg>

      {/* Center readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {hasGoal ? (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "tnum text-[52px] font-semibold leading-none tracking-tighter",
                over && "text-destructive",
              )}
            >
              {gentle
                ? `${Math.round(rawRatio * 100)}%`
                : formatKcal(Math.abs(remaining))}
            </span>
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {gentle ? "of goal" : over ? "kcal over" : "kcal left"}
            </span>
            <span className="tnum mt-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              {Math.round(rawRatio * 100)}% of goal
            </span>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="tnum text-[52px] font-semibold leading-none tracking-tighter"
            >
              {gentle ? "•••" : formatKcal(consumed)}
            </span>
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              kcal eaten
            </span>
            <span className="mt-1 text-[11px] text-muted-foreground">
              Set a goal in Settings
            </span>
          </>
        )}
      </div>
    </div>
  );
}
