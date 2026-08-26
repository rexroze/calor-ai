"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, PencilLineIcon, PlusIcon, Trash2Icon } from "lucide-react";

import type { ConfidenceLevel } from "@/lib/contracts";
import {
  isCustomAmount,
  withManualMacroEdit,
  withManualPortionEdit,
  withMultiplier,
  type DraftItem,
} from "@/components/shared/draft-items";
import { PortionChips } from "@/components/meals/portion-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The editable item list shared by /capture review and the meal editor.
 * Every field stays a string while typing (see draft-items.ts); totals are
 * derived elsewhere. `onAdd`/`onRemove` are optional so read-mostly contexts
 * can hide affordances they don't need.
 *
 * `focusFirstNameSignal` lets a parent (the capture low-confidence banner)
 * pop the first item's name straight into its editor.
 */
export function ReviewItemRows({
  items,
  onChange,
  onRemove,
  onAdd,
  disabled = false,
  focusFirstNameSignal = 0,
}: {
  items: DraftItem[];
  onChange: (index: number, patch: Partial<DraftItem>) => void;
  onRemove?: (index: number) => void;
  onAdd?: () => void;
  disabled?: boolean;
  focusFirstNameSignal?: number;
}) {
  const idBase = useId();
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);

  // Banner-driven correction loop: a bumped signal opens the editor on row 0.
  const lastSignalRef = useRef(focusFirstNameSignal);
  useEffect(() => {
    if (focusFirstNameSignal > lastSignalRef.current) {
      lastSignalRef.current = focusFirstNameSignal;
      setRenamingIndex(0);
    }
  }, [focusFirstNameSignal]);

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
              renaming={renamingIndex === index}
              onRenameStart={() => setRenamingIndex(index)}
              onRenameEnd={() =>
                setRenamingIndex((current) =>
                  current === index ? null : current,
                )
              }
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
  renaming,
  onRenameStart,
  onRenameEnd,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  index: number;
  idPrefix: string;
  disabled: boolean;
  canRemove: boolean;
  renaming: boolean;
  onRenameStart: () => void;
  onRenameEnd: () => void;
  onChange: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
}) {
  const field = (name: keyof DraftItem) => `${idPrefix}-${name}-${index}`;
  const displayName = item.name.trim();

  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          {/* Name: plain-looking text until tapped, then an inline editor —
              the cheap correction loop for AI misidentifications. */}
          <div className="space-y-1">
            <div className="flex min-h-6 items-center gap-1.5">
              {renaming ? (
                <Label htmlFor={field("name")} className="sr-only">
                  Food name
                </Label>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex-1 text-xs text-muted-foreground"
                >
                  Food
                </span>
              )}
              {item.confidence && <ConfidenceChip level={item.confidence} />}
            </div>

            {renaming ? (
              <NameEditor
                id={field("name")}
                initialName={displayName}
                disabled={disabled}
                onCommit={(name) => {
                  if (name !== item.name) onChange({ name });
                  onRenameEnd();
                }}
                onCancel={onRenameEnd}
              />
            ) : (
              <button
                type="button"
                onClick={onRenameStart}
                disabled={disabled}
                aria-label={
                  displayName
                    ? `Food name: ${displayName}. Activate to change it`
                    : "Food name is empty. Activate to add one"
                }
                className={cn(
                  "group/name flex h-10 w-full items-center gap-1.5 rounded-lg px-1 text-left text-sm font-medium",
                  "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  "disabled:pointer-events-none disabled:opacity-50",
                  !displayName && "text-muted-foreground italic",
                )}
              >
                <span className="truncate">
                  {displayName || "Add food name"}
                </span>
                <PencilLineIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-visible/name:opacity-100"
                />
              </button>
            )}
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
              onChange={(e) =>
                onChange(withManualPortionEdit(item, e.target.value))
              }
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
            aria-label={`Remove ${displayName || `item ${index + 1}`}`}
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
          onChange={(v) => onChange(withManualMacroEdit(item, "calories", v))}
          disabled={disabled}
        />
        <MacroField
          id={field("proteinG")}
          label="Prot g"
          dotClass="bg-protein"
          value={item.proteinG}
          onChange={(v) => onChange(withManualMacroEdit(item, "proteinG", v))}
          disabled={disabled}
        />
        <MacroField
          id={field("carbsG")}
          label="Carb g"
          dotClass="bg-carbs"
          value={item.carbsG}
          onChange={(v) => onChange(withManualMacroEdit(item, "carbsG", v))}
          disabled={disabled}
        />
        <MacroField
          id={field("fatG")}
          label="Fat g"
          dotClass="bg-fat"
          value={item.fatG}
          onChange={(v) => onChange(withManualMacroEdit(item, "fatG", v))}
          disabled={disabled}
        />
      </div>

      <div className="mt-3">
        <PortionChips
          multiplier={item.scaling?.multiplier ?? 1}
          custom={isCustomAmount(item)}
          onSelect={(multiplier) => onChange(withMultiplier(item, multiplier))}
          disabled={disabled}
          label={`Adjust amount for ${displayName || `item ${index + 1}`}`}
        />
      </div>
    </div>
  );
}

/**
 * Inline name editor: autofocuses (scrolling the row into view), Enter or
 * blur commits, Escape restores the previous name.
 */
function NameEditor({
  id,
  initialName,
  disabled,
  onCommit,
  onCancel,
}: {
  id: string;
  initialName: string;
  disabled?: boolean;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialName);
  const committedRef = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
    el.select();
  }, []);

  function commit() {
    if (committedRef.current) return; // blur after Enter/Esc must not double-fire
    committedRef.current = true;
    onCommit(value.trim());
  }

  function cancel() {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  }

  return (
    <Input
      ref={inputRef}
      id={id}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      onBlur={commit}
      placeholder="e.g. Grilled pork chop"
      autoComplete="off"
      disabled={disabled}
      className="h-10"
    />
  );
}

/**
 * Compact per-item confidence marker: amber dot when the model was unsure,
 * muted dot for medium, subtle check for high — wording stays in the
 * accessibility tree only.
 */
function ConfidenceChip({ level }: { level: ConfidenceLevel }) {
  if (level === "high") {
    return (
      <span
        title="High identification confidence"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-protein/15"
      >
        <CheckIcon aria-hidden="true" className="size-3.5 text-protein" />
        <span className="sr-only">High identification confidence</span>
      </span>
    );
  }

  if (level === "medium") {
    return (
      <span
        title="Medium identification confidence"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted-foreground/15"
      >
        <span
          aria-hidden="true"
          className="size-2 rounded-full bg-muted-foreground/70"
        />
        <span className="sr-only">Medium identification confidence</span>
      </span>
    );
  }

  return (
    <span
      title="Low identification confidence"
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-carbs/15"
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-carbs" />
      <span className="sr-only">
        Low identification confidence — double-check this item
      </span>
    </span>
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
