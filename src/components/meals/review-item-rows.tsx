"use client";

import { useId } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { DraftItem } from "@/components/shared/draft-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The editable item list shared by /capture review and the meal editor.
 * Every field stays a string while typing (see draft-items.ts); totals are
 * derived elsewhere. `onAdd`/`onRemove` are optional so read-mostly contexts
 * can hide affordances they don't need.
 */
export function ReviewItemRows({
  items,
  onChange,
  onRemove,
  onAdd,
  disabled = false,
}: {
  items: DraftItem[];
  onChange: (index: number, patch: Partial<DraftItem>) => void;
  onRemove?: (index: number) => void;
  onAdd?: () => void;
  disabled?: boolean;
}) {
  const idBase = useId();

  return (
    <div className="space-y-3">
      <ul role="list" className="space-y-3">
        {items.map((item, index) => (
          <li key={index}>
            <ItemRow
              item={item}
              index={index}
              idPrefix={idBase}
              disabled={disabled}
              canRemove={items.length > 1 && !!onRemove}
              onChange={(patch) => onChange(index, patch)}
              onRemove={() => onRemove?.(index)}
            />
          </li>
        ))}
      </ul>

      {onAdd && (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="min-h-11 w-full border border-dashed border-border text-muted-foreground"
          onClick={onAdd}
          disabled={disabled}
        >
          <PlusIcon aria-hidden="true" />
          Add another item
        </Button>
      )}
    </div>
  );
}

function ItemRow({
  item,
  index,
  idPrefix,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  index: number;
  idPrefix: string;
  disabled: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
}) {
  const field = (name: keyof DraftItem) => `${idPrefix}-${name}-${index}`;

  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <Label htmlFor={field("name")} className="text-xs text-muted-foreground">
              Food
            </Label>
            <Input
              id={field("name")}
              value={item.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Grilled chicken breast"
              autoComplete="off"
              disabled={disabled}
              className="h-10"
            />
          </div>

          <div className="space-y-1">
            <Label
              htmlFor={field("portionDescription")}
              className="text-xs text-muted-foreground"
            >
              Portion
            </Label>
            <Input
              id={field("portionDescription")}
              value={item.portionDescription}
              onChange={(e) => onChange({ portionDescription: e.target.value })}
              placeholder="e.g. 150 g"
              autoComplete="off"
              disabled={disabled}
              className="h-10"
            />
          </div>
        </div>

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="mt-6 size-11 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${item.name.trim() || `item ${index + 1}`}`}
            onClick={onRemove}
            disabled={disabled}
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <MacroField
          id={field("calories")}
          label="kcal"
          value={item.calories}
          onChange={(v) => onChange({ calories: v })}
          disabled={disabled}
        />
        <MacroField
          id={field("proteinG")}
          label="Prot g"
          dotClass="bg-protein"
          value={item.proteinG}
          onChange={(v) => onChange({ proteinG: v })}
          disabled={disabled}
        />
        <MacroField
          id={field("carbsG")}
          label="Carb g"
          dotClass="bg-carbs"
          value={item.carbsG}
          onChange={(v) => onChange({ carbsG: v })}
          disabled={disabled}
        />
        <MacroField
          id={field("fatG")}
          label="Fat g"
          dotClass="bg-fat"
          value={item.fatG}
          onChange={(v) => onChange({ fatG: v })}
          disabled={disabled}
        />
      </div>

      {item.confidence && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Estimated confidence:{" "}
          <span
            className={cn(
              "font-medium",
              item.confidence === "high" && "text-protein",
              item.confidence === "medium" && "text-carbs",
              item.confidence === "low" && "text-fat",
            )}
          >
            {item.confidence}
          </span>
        </p>
      )}
    </div>
  );
}

function MacroField({
  id,
  label,
  value,
  onChange,
  disabled,
  dotClass,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  dotClass?: string;
}) {
  return (
    <div className="space-y-1">
      <Label
        htmlFor={id}
        className="flex items-center gap-1 text-[10px] tracking-wide text-muted-foreground uppercase"
      >
        {dotClass && (
          <span aria-hidden="true" className={cn("size-1.5 rounded-full", dotClass)} />
        )}
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        autoComplete="off"
        disabled={disabled}
        className="tnum h-9 px-2 text-center text-sm"
      />
    </div>
  );
}
