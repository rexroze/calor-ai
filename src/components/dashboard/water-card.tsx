"use client";

import { useRef, useState } from "react";
import { CupSodaIcon, GlassWaterIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { logWater } from "@/app/actions/water";
import { useUnits } from "@/components/shared/preferences";
import { formatFlOz } from "@/components/shared/units";
import { cn } from "@/lib/utils";

const fmtMl = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const QUICK_ADD_BTN =
  "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/40 text-sm font-medium transition-colors duration-150 hover:bg-muted active:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

/**
 * Today-only water tracker. Quick-adds update the bar optimistically and
 * reconcile with the authoritative total from logWater; the server action
 * revalidates "/" so the RSC tree stays truthful.
 *
 * Optimistic pattern (safe under Next's sequential per-client action
 * dispatch): apply ±delta to local state immediately, then replace it with
 * the returned totalMl. A monotonic seq guard drops stale responses so an
 * older reply can never overwrite a newer one; failures roll the delta back.
 */
export function WaterCard({
  dateISO,
  initialTotalMl,
  goalMl,
}: {
  dateISO: string;
  initialTotalMl: number;
  goalMl: number;
}) {
  const goal = Math.max(0, Math.round(goalMl));
  const [total, setTotal] = useState(() =>
    Math.max(0, Math.round(initialTotalMl)),
  );
  /** Most recent positive quick-add delta — session-scoped undo target. */
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const seqRef = useRef(0);

  async function mutate(delta: number) {
    const seq = ++seqRef.current;
    setTotal((current) => Math.max(0, current + delta));
    if (delta > 0) setLastDelta(delta);

    try {
      const { totalMl } = await logWater(dateISO, delta);
      if (seq === seqRef.current) setTotal(totalMl);
    } catch {
      // Roll back only if no newer gesture has taken over meanwhile.
      if (seq === seqRef.current) {
        setTotal((current) => Math.max(0, current - delta));
        toast.error("Couldn't update water. Please try again.");
      }
    }
  }

  async function undo() {
    const delta = lastDelta;
    if (delta === null) return;
    setLastDelta(null);
    await mutate(-delta);
  }

  const pct = goal > 0 ? Math.min(100, (total / goal) * 100) : 0;
  const reached = goal > 0 && total >= goal;

  // Imperial adds an approximate fl-oz hint; ml stays the primary unit and
  // gentle mode never touches water (ml isn't a calorie).
  const [units] = useUnits();
  const imperial = units === "imperial";

  return (
    <section
      aria-label="Water intake"
      className="reveal mt-5 rounded-3xl border bg-card p-5 shadow-sm"
      style={{ animationDelay: "60ms" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Water
        </h2>
        <p
          className="tnum text-xs text-muted-foreground"
          aria-live="polite"
        >
          <span
            className={cn(
              "font-semibold",
              reached ? "text-primary" : "text-foreground",
            )}
          >
            {fmtMl.format(total)}
          </span>
          {" / "}
          {fmtMl.format(goal)} ml
          {imperial && (
            <span className="ml-1 opacity-80">(≈{formatFlOz(total)})</span>
          )}
          {reached && (
            <span className="ml-1.5 font-medium text-primary">Goal!</span>
          )}
        </p>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`Water: ${fmtMl.format(total)} of ${goal > 0 ? `${fmtMl.format(goal)} milliliters` : "no goal set"}`}
        aria-valuemin={0}
        aria-valuemax={goal > 0 ? goal : undefined}
        aria-valuenow={Math.round(total)}
      >
        <div
          className={cn(
            "h-full rounded-full",
            // Celebration tint at full strength once the goal is met.
            reached ? "bg-primary" : "bg-primary/50",
          )}
          style={{
            width: `${pct}%`,
            transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>

      <div className="mt-3.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => void mutate(250)}
          className={QUICK_ADD_BTN}
        >
          <CupSodaIcon className="size-4 text-primary" aria-hidden="true" />
          +250 ml
        </button>
        <button
          type="button"
          onClick={() => void mutate(500)}
          className={QUICK_ADD_BTN}
        >
          <GlassWaterIcon className="size-4 text-primary" aria-hidden="true" />
          +500 ml
        </button>
        {lastDelta !== null && (
          <button
            type="button"
            onClick={() => void undo()}
            aria-label={`Undo last addition (${lastDelta} milliliters)`}
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-border/60 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <RotateCcwIcon className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
