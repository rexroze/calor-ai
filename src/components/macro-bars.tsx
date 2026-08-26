"use client";

import { BeefIcon, DropletIcon, WheatIcon } from "lucide-react";
import type { MacroTotals } from "@/lib/contracts";
import { useEnterProgress } from "@/components/shared/use-enter-progress";
import { useGentle } from "@/components/shared/preferences";
import { fmtNum } from "@/components/shared/format";
import { cn } from "@/lib/utils";

type MacroKey = keyof Omit<MacroTotals, "calories">;

const MACRO_META: Record<
  MacroKey,
  {
    label: string;
    icon: typeof BeefIcon;
    textClass: string;
    barClass: string;
    tileClass: string;
  }
> = {
  proteinG: {
    label: "Protein",
    icon: BeefIcon,
    textClass: "text-protein",
    barClass: "bg-protein",
    tileClass: "bg-protein/15",
  },
  carbsG: {
    label: "Carbs",
    icon: WheatIcon,
    textClass: "text-carbs",
    barClass: "bg-carbs",
    tileClass: "bg-carbs/15",
  },
  fatG: {
    label: "Fat",
    icon: DropletIcon,
    textClass: "text-fat",
    barClass: "bg-fat",
    tileClass: "bg-fat/15",
  },
};

/**
 * The three macro bars under the calorie ring.
 * Colors are semantic everywhere in the app: protein=emerald, carbs=amber, fat=violet.
 */
export function MacroBars({
  totals,
  goals,
}: {
  totals: MacroTotals;
  goals: MacroTotals;
}) {
  const keys: MacroKey[] = ["proteinG", "carbsG", "fatG"];

  return (
    <ul role="list" className="space-y-4">
      {keys.map((key) => (
        <MacroBarRow
          key={key}
          meta={MACRO_META[key]}
          value={totals[key]}
          goal={goals[key]}
        />
      ))}
    </ul>
  );
}

function MacroBarRow({
  meta,
  value,
  goal,
}: {
  meta: (typeof MACRO_META)[MacroKey];
  value: number;
  goal: number;
}) {
  // Exact fill = value/goal, clamped to [0, 1]. The clamp must happen on the
  // raw number BEFORE it reaches CSS: a non-finite or >1 value would produce
  // an invalid/auto inline width (a block child paints full-width), which is
  // how a 87%-of-goal bar could ever render looking ~full.
  const rawRatio = goal > 0 ? value / goal : 0;
  const ratio = Number.isFinite(rawRatio)
    ? Math.min(1, Math.max(0, rawRatio))
    : 0;
  const progress = useEnterProgress(ratio);
  const over = goal > 0 && value > goal;
  // Gentle mode: bars + names stay; visible gram figures hide behind a
  // width-stable placeholder. The progressbar's aria-label keeps the real
  // numbers for screen readers.
  const [gentle] = useGentle();
  const Icon = meta.icon;

  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]",
          meta.tileClass,
          meta.textClass,
        )}
      >
        <Icon strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{meta.label}</span>
          <span
            className={cn(
              "tnum shrink-0 text-xs font-medium",
              // Neutral for every row; red only when the goal is exceeded (>100%).
              over ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {gentle ? (
              <>
                <span aria-hidden="true">•••</span>
                <span className="sr-only">
                  {fmtNum(value)} of{" "}
                  {goal > 0 ? `${fmtNum(goal)} grams` : "no goal set"}
                </span>
              </>
            ) : (
              <>
                {fmtNum(value)}
                {goal > 0 ? ` / ${fmtNum(goal)} g` : " g"}
              </>
            )}
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`${meta.label}: ${fmtNum(value)} of ${goal > 0 ? `${fmtNum(goal)} grams` : "no goal set"}`}
          aria-valuemin={0}
          aria-valuemax={goal > 0 ? goal : undefined}
          aria-valuenow={Math.round(value)}
        >
          <div
            className={cn("h-full rounded-full", meta.barClass)}
            style={{
              width: `${Math.round(progress * 100)}%`,
              transition:
                "width 900ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>
      </div>
    </li>
  );
}
