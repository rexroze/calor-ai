"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  LoaderCircleIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { deleteMeal, updateMeal } from "@/app/actions/meals";
import { describeActionError } from "@/components/shared/action-errors";
import {
  draftToFoodItemInput,
  emptyDraftItem,
  isDraftMeaningful,
  type DraftItem,
} from "@/components/shared/draft-items";
import { fmtNum, formatKcal, parseNonNegative } from "@/components/shared/format";
import {
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
  inferMealType,
  isMealType,
} from "@/components/shared/meal-types";
import { DraftTotals } from "@/components/meals/draft-totals";
import { ReviewItemRows } from "@/components/meals/review-item-rows";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MealEntry, MealType } from "@/lib/contracts";

function entryToDrafts(meal: MealEntry): DraftItem[] {
  if (meal.items.length === 0) return [emptyDraftItem()];
  return meal.items.map((item) => ({
    name: item.name,
    portionDescription: item.portionDescription,
    calories: String(Math.round(item.calories)),
    proteinG: String(fmtNum(item.proteinG)),
    carbsG: String(fmtNum(item.carbsG)),
    fatG: String(fmtNum(item.fatG)),
  }));
}

/**
 * Edit surface for one logged meal: the same review rows used at capture,
 * plus meal-type/note editing and a confirmed delete. `dateISO` is where
 * every exit route points back to.
 */
export function MealEditor({
  dateISO,
  meal,
}: {
  dateISO: string;
  meal: MealEntry;
}) {
  const router = useRouter();

  const [drafts, setDrafts] = useState<DraftItem[]>(() => entryToDrafts(meal));
  const [mealType, setMealType] = useState<MealType>(() =>
    isMealType(meal.mealType) ? meal.mealType : inferMealType(),
  );
  const [note, setNote] = useState(meal.note ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function updateDraft(index: number, patch: Partial<DraftItem>) {
    setDrafts((prev) =>
      prev.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    );
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const items = drafts.filter(isDraftMeaningful).map(draftToFoodItemInput);
    if (items.length === 0) {
      toast.error("Add at least one food with a name or calorie estimate.");
      return;
    }

    setSaving(true);
    try {
      await updateMeal({
        mealId: meal.id,
        // eatenAt and photoUrl are intentionally omitted — untouched server-side.
        mealType,
        note: note.trim() || undefined,
        items,
      });
      toast.success("Changes saved");
      router.replace(`/?date=${dateISO}`);
    } catch (error) {
      toast.error(describeActionError(error));
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMeal(meal.id);
      toast.success("Meal removed");
      router.replace(`/?date=${dateISO}`);
    } catch (error) {
      toast.error(describeActionError(error));
      setDeleting(false);
    }
  }

  const busy = saving || deleting;

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-safe pb-56" aria-busy={busy}>
      <div className="space-y-5">
        <section className="reveal" style={{ animationDelay: "0ms" }}>
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Edit meal
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Corrections here update your day&apos;s totals instantly.
          </p>
        </section>

        {meal.photoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={meal.photoUrl}
            alt={`Photo of this ${MEAL_TYPE_LABELS[mealType].toLowerCase()}`}
            className="aspect-[4/3] w-full rounded-2xl object-cover shadow-sm ring-1 ring-border reveal"
            style={{ animationDelay: "40ms" }}
          />
        )}

        <div className="grid grid-cols-1 gap-4 reveal" style={{ animationDelay: "80ms" }}>
          <div className="space-y-1.5">
            <Label htmlFor="meal-edit-type">Meal</Label>
            <Select
              value={mealType}
              onValueChange={(value) => {
                if (isMealType(value)) setMealType(value);
              }}
            >
              <SelectTrigger
                id="meal-edit-type"
                className="h-10 w-full bg-card data-[size=default]:h-10"
                disabled={busy}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPE_ORDER.map((type) => (
                  <SelectItem key={type} value={type}>
                    {MEAL_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meal-edit-note">Note</Label>
            <Textarea
              id="meal-edit-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Anything worth remembering about this meal?"
              rows={2}
              maxLength={2000}
              disabled={busy}
              className="resize-none bg-card"
            />
          </div>
        </div>

        <section
          className="space-y-3 reveal"
          style={{ animationDelay: "120ms" }}
          aria-label="Foods in this meal"
        >
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Items
          </h2>
          <ReviewItemRows
            items={drafts}
            onChange={updateDraft}
            onRemove={(index) => removeDraft(index)}
            onAdd={() => setDrafts((prev) => [...prev, emptyDraftItem()])}
            disabled={busy}
          />
        </section>

        <p className="pt-1 text-center text-xs text-muted-foreground reveal" style={{ animationDelay: "160ms" }}>
          <span className="sr-only">Changed your mind? </span>
          <Link
            href={`/?date=${dateISO}`}
            className="font-medium text-terracotta underline-offset-4 hover:underline"
          >
            Back to the day without saving
          </Link>
        </p>
      </div>

      {/* Sticky action deck above the safe area. */}
      <footer className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="rounded-2xl border bg-card/95 p-3.5 shadow-lg shadow-foreground/5 backdrop-blur">
          <div aria-live="polite">
            <DraftTotals drafts={drafts} />
          </div>
          <Separator className="my-3" />
          <div className="flex gap-2.5">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Delete this ${MEAL_TYPE_LABELS[mealType].toLowerCase()}`}
                  disabled={busy}
                >
                  {deleting ? (
                    <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2Icon aria-hidden="true" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove this meal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its{" "}
                    <span className="tnum font-medium">
                      {formatKcal(sumCalories(drafts))}
                    </span>{" "}
                    kcal come off this day&apos;s totals. This can&apos;t be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={deleting}
                    onClick={(event) => {
                      event.preventDefault();
                      void handleDelete();
                    }}
                  >
                    Remove meal
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              type="button"
              size="lg"
              className="h-11 flex-1 text-base"
              onClick={handleSave}
              disabled={busy}
            >
              {saving ? (
                <>
                  <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckIcon aria-hidden="true" />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </div>
      </footer>
    </main>
  );
}

function sumCalories(drafts: DraftItem[]): number {
  return drafts.reduce(
    (total, draft) => total + parseNonNegative(draft.calories),
    0,
  );
}
