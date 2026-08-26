"use client";

import { useGentle } from "@/components/shared/preferences";
import { formatKcal } from "@/components/shared/format";
import { cn } from "@/lib/utils";

/**
 * A single calorie figure that respects gentle mode.
 *
 * Server render (and hydration) always emits the full number, keeping SSR
 * markup stable; when gentle mode is on, the visible digits swap to a
 * width-stable "•••" placeholder while a sr-only span preserves the real
 * value for screen readers. The pre-paint bootstrap in layout.tsx sets
 * html[data-gentle] before first paint, and the store subscription flips
 * this island right after hydration — no flash, no hydration warning.
 */
export function KcalText({
  kcal,
  suffix,
  className,
}: {
  kcal: number;
  /** Rendered after the number in normal mode only (" kcal"). */
  suffix?: string;
  className?: string;
}) {
  const [gentle] = useGentle();

  return (
    <span className={cn("tnum", className)}>
      {gentle ? (
        <>
          <span aria-hidden="true">•••</span>
          <span className="sr-only">{formatKcal(kcal)} kilocalories</span>
        </>
      ) : (
        <>
          {formatKcal(kcal)}
          {suffix ?? null}
        </>
      )}
    </span>
  );
}
