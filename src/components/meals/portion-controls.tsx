"use client";

import { cn } from "@/lib/utils";

/**
 * Portion-multiplier chips for one review item: ½× / 1× / 1½× / 2×.
 * Presentational only — scaling math lives in draft-items.ts so totals and
 * the save payload derive from the rewritten strings automatically.
 */
export const PORTION_PRESETS = [
  { value: 0.5, label: "½×", name: "Half portion" },
  { value: 1, label: "1×", name: "Original portion" },
  { value: 1.5, label: "1½×", name: "One and a half portions" },
  { value: 2, label: "2×", name: "Double portion" },
] as const;

/**
 * Segmented preset row (≥40px targets, aria-pressed per chip) plus a
 * "Custom ×" marker whenever hand edits have detached fields from scaling —
 * no preset is then an honest description of the displayed numbers.
 */
export function PortionChips({
  multiplier,
  custom,
  onSelect,
  disabled = false,
  label,
}: {
  /** Multiplier currently reflected in the item's numbers. */
  multiplier: number;
  /** A manual edit has detached fields; highlight no preset. */
  custom: boolean;
  onSelect: (multiplier: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        role="group"
        aria-label={label}
        className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-border bg-muted/30 p-1"
      >
        {PORTION_PRESETS.map((preset) => {
          const active = !custom && multiplier === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onSelect(preset.value)}
              className={cn(
                "h-10 min-w-10 flex-1 rounded-lg text-sm font-medium tnum transition-colors",
                "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                "disabled:pointer-events-none disabled:opacity-50",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span aria-hidden="true">{preset.label}</span>
              <span className="sr-only">{preset.name}</span>
            </button>
          );
        })}
      </div>

      {custom && (
        <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          <span aria-hidden="true">Custom ×</span>
          <span className="sr-only">
            Custom amounts — manually edited values are kept as typed and no
            longer follow the multipliers
          </span>
        </span>
      )}
    </div>
  );
}
