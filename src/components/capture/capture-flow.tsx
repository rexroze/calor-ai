"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CameraIcon,
  CircleAlertIcon,
  FlameIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
} from "lucide-react";
import { toast } from "sonner";

import { analyzePhoto, saveMeal, uploadMealPhoto } from "@/app/actions/meals";
import { describeActionError } from "@/components/shared/action-errors";
import {
  emptyDraftItem,
  draftToFoodItemInput,
  isDraftMeaningful,
  type DraftItem,
} from "@/components/shared/draft-items";
import { base64FromDataUrl, downscaleToJpegDataUrl } from "@/components/capture/downscale-image";
import { fmtNum } from "@/components/shared/format";
import { DraftTotals } from "@/components/meals/draft-totals";
import { ReviewItemRows } from "@/components/meals/review-item-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FoodAnalysisItem, MealType } from "@/lib/contracts";
import {
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
  inferMealType,
  isMealType,
} from "@/components/shared/meal-types";

/** Rotating copy for the analysis wait — keeps a ~2s call feeling alive. */
const PENDING_MESSAGES = [
  "Reading the plate…",
  "Spotting each item…",
  "Estimating portions…",
  "Tallying the macros…",
];

function analysisToDraft(item: FoodAnalysisItem): DraftItem {
  return {
    name: item.name,
    portionDescription: item.portionDescription,
    calories: String(Math.round(item.calories)),
    proteinG: String(fmtNum(item.proteinG)),
    carbsG: String(fmtNum(item.carbsG)),
    fatG: String(fmtNum(item.fatG)),
    confidence: item.confidence,
  };
}

/**
 * Full capture flow: pick -> analyze -> review -> save.
 * Rendered inside a Suspense boundary because of useSearchParams (?type=).
 */
export function CaptureFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<"pick" | "analyzing" | "review">("pick");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const [drafts, setDrafts] = useState<DraftItem[]>([emptyDraftItem()]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingMessage, setPendingMessage] = useState(PENDING_MESSAGES[0]);
  const [mealType, setMealType] = useState<MealType>(() => {
    const requested = searchParams.get("type");
    return isMealType(requested) ? requested : inferMealType();
  });

  useEffect(() => {
    if (phase !== "analyzing") return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setPendingMessage(PENDING_MESSAGES[i % PENDING_MESSAGES.length]);
    }, 1600);
    return () => clearInterval(id);
  }, [phase]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || phase === "analyzing") return;

    setPhase("analyzing");
    let preview: string;
    try {
      preview = await downscaleToJpegDataUrl(file);
    } catch {
      toast.error("Couldn't read that photo. Try taking another one.");
      setPhase("pick");
      return;
    }

    try {
      const analysis = await analyzePhoto(base64FromDataUrl(preview));
      setPhotoPreview(preview);
      setDrafts(analysis.items.map(analysisToDraft));
      setAnalysisFailed(false);
    } catch (error) {
      // The photo itself was fine if it downscaled — let the user log by hand
      // instead of losing the moment to a flaky model call.
      setPhotoPreview(preview);
      setDrafts([emptyDraftItem()]);
      setAnalysisFailed(true);
      toast.error(describeActionError(error));
    }
    setPhase("review");
  }

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
      // Persist the analyzed photo first so saveMeal can store its URL in one
      // write. Upload trouble must never block logging the meal — a null URL
      // simply saves a photoless entry.
      let photoUrl: string | undefined;
      if (photoPreview) {
        try {
          const uploaded = await uploadMealPhoto(base64FromDataUrl(photoPreview));
          photoUrl = uploaded.photoUrl ?? undefined;
        } catch {
          photoUrl = undefined;
        }
      }

      await saveMeal({
        mealType,
        note: note.trim() || undefined,
        ...(photoUrl !== undefined ? { photoUrl } : {}),
        items,
      });
      toast.success("Meal logged");
      router.replace("/");
    } catch (error) {
      toast.error(describeActionError(error));
      setSaving(false);
    }
  }

  function resetToPick() {
    setPhase("pick");
    setPhotoPreview(null);
    setAnalysisFailed(false);
    setDrafts([emptyDraftItem()]);
  }

  const busy = phase === "analyzing" || saving;

  return (
    <>
      {/* Hidden pickers: camera honors the rear lens, gallery opens freely. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      <main className="mx-auto w-full max-w-md px-4 pt-safe pb-52" aria-busy={busy}>
        {phase !== "review" ? (
          <section
            className="reveal rounded-3xl border bg-card p-6 shadow-sm"
            style={{ animationDelay: "0ms" }}
          >
            <PlateVisual analyzing={phase === "analyzing"} />

            {phase === "pick" ? (
              <div className="mt-6 space-y-5">
                <div className="space-y-1.5 text-center">
                  <h2 className="font-display text-xl font-semibold tracking-tight">
                    Snap your plate
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    One clear photo is all calorAI needs to estimate calories
                    and macros.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <Button
                    type="button"
                    size="lg"
                    className="h-11 w-full text-base"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={busy}
                  >
                    <CameraIcon aria-hidden="true" />
                    Take photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-11 w-full text-base"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={busy}
                  >
                    <ImagePlusIcon aria-hidden="true" />
                    Choose from library
                  </Button>
                </div>

                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  Photos are analyzed to estimate nutrition and are kept only in
                  your own diary.
                </p>
              </div>
            ) : (
              <div role="status" aria-live="polite" className="mt-6 space-y-3 text-center">
                <p className="text-base font-medium">{pendingMessage}</p>
                <p className="text-xs text-muted-foreground">
                  Usually takes a couple of seconds.
                </p>
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-5">
            <section className="reveal flex items-center gap-3" style={{ animationDelay: "0ms" }}>
              {photoPreview && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photoPreview}
                  alt="The meal photo you just took"
                  className="size-14 shrink-0 rounded-xl object-cover ring-1 ring-border"
                />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Does this look right?
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  Adjust names, portions and numbers before logging.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className="size-11 shrink-0 text-muted-foreground"
                onClick={resetToPick}
                disabled={saving}
                aria-label="Take a different photo"
              >
                <RotateCcwIcon aria-hidden="true" />
              </Button>
            </section>

            {analysisFailed && (
              <p className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">
                <CircleAlertIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
                The automatic estimate didn&apos;t come through. Enter the foods
                below by hand — everything else still works.
              </p>
            )}

            <div className="grid grid-cols-[auto_1fr] items-end gap-3 reveal" style={{ animationDelay: "60ms" }}>
              <div className="space-y-1.5">
                <Label htmlFor="capture-meal-type">Meal</Label>
                <Select
                  value={mealType}
                  onValueChange={(value) => {
                    if (isMealType(value)) setMealType(value);
                  }}
                >
                  <SelectTrigger
                    id="capture-meal-type"
                    className="h-10 w-36 bg-card data-[size=default]:h-10"
                    disabled={saving}
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
                <Label htmlFor="capture-note">Note</Label>
                <Input
                  id="capture-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional — e.g. brunch with Sam"
                  autoComplete="off"
                  maxLength={280}
                  disabled={saving}
                  className="h-10 bg-card"
                />
              </div>
            </div>

            <section
              className="space-y-3 reveal"
              style={{ animationDelay: "120ms" }}
              aria-label="Foods in this meal"
            >
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Items
              </h3>
              <ReviewItemRows
                items={drafts}
                onChange={updateDraft}
                onRemove={removeDraft}
                onAdd={() =>
                  setDrafts((prev) => [...prev, emptyDraftItem()])
                }
                disabled={saving}
              />
            </section>

            <p className="pt-1 text-center text-xs text-muted-foreground">
              <span className="sr-only">Need to start over? </span>
              <Link
                href="/"
                className="font-medium text-terracotta underline-offset-4 hover:underline"
              >
                Cancel and go back to today
              </Link>
            </p>
          </div>
        )}
      </main>

      {phase === "review" && (
        <footer className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <div className="rounded-2xl border bg-card/95 p-3.5 shadow-lg shadow-foreground/5 backdrop-blur">
            <DraftTotals drafts={drafts} />
            <Separator className="my-3" />
            <Button
              type="button"
              size="lg"
              className="h-11 w-full text-base"
              onClick={handleSave}
              disabled={busy}
            >
              {saving ? (
                <>
                  <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                  Logging…
                </>
              ) : (
                "Log meal"
              )}
            </Button>
          </div>
        </footer>
      )}
    </>
  );
}

/** Decorative plate with breathing flame and radar pulses while analyzing. */
function PlateVisual({ analyzing }: { analyzing: boolean }) {
  return (
    <div className="relative mx-auto grid size-28 place-items-center">
      {analyzing && (
        <>
          <span
            aria-hidden="true"
            className="animate-plate-pulse absolute inset-0 rounded-full border border-primary/40"
          />
          <span
            aria-hidden="true"
            className="animate-plate-pulse absolute inset-0 rounded-full border border-primary/25"
            style={{ animationDelay: "0.7s" }}
          />
        </>
      )}
      <div className="grid size-20 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/20">
        <FlameIcon
          aria-hidden="true"
          className={`size-9 text-primary ${analyzing ? "animate-breathe" : ""}`}
          strokeWidth={1.8}
        />
      </div>
    </div>
  );
}
