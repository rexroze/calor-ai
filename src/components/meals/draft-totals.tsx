"use client";

import type { DraftItem } from "@/components/shared/draft-items";
import { sumDrafts } from "@/components/shared/draft-items";
import { fmtNum, formatKcal } from "@/components/shared/format";

/**
 * Live kcal + macro readout for whatever is currently in the draft rows.
 * Pure derivation — no local state — so it can sit in a sticky footer and
 * update as the user edits.
 */
export function DraftTotals({ drafts }: { drafts: DraftItem[] }) {
  const totals = sumDrafts(drafts);

  return (
    <dl className="flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-1.5">
        <dt className="sr-only">Total calories</dt>
        <dd className="tnum text-2xl font-semibold leading-none tracking-tighter">
          {formatKcal(totals.calories)}
        </dd>
        <dd className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          kcal
        </dd>
      </div>

      <div className="flex items-center gap-3">
        <MacroStat label="Protein" value={totals.proteinG} dotClass="bg-protein" />
        <MacroStat label="Carbs" value={totals.carbsG} dotClass="bg-carbs" />
        <MacroStat label="Fat" value={totals.fatG} dotClass="bg-fat" />
      </div>
    </dl>
  );
}

function MacroStat({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: number;
  dotClass: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <dt className="sr-only">{label}</dt>
      <dd className="tnum text-sm leading-none font-medium">{fmtNum(value)}g</dd>
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${dotClass}`}
        title={label}
      />
    </div>
  );
}
