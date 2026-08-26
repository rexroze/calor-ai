"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CameraIcon,
  CircleAlertIcon,
  FlameIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  PencilLineIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { analyzePhoto, saveMeal, uploadMealPhoto } from "@/app/actions/meals";
import { cacheMealPhoto } from "@/lib/photo-cache";
import { describeActionError } from "@/components/shared/action-errors";
import {
  draftFromAnalysis,
  draftToFoodItemInput,
  emptyDraftItem,
  isDraftMeaningful,
  type DraftItem,
} from "@/components/shared/draft-items";
import { prepareAnalysisImage, type PreparedAnalysisImage } from "@/components/capture/downscale-image";
import { ScanOverlay } from "@/components/capture/scan-overlay";
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
import type { MealType } from "@/lib/contracts";
import {
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
  inferMealType,
  isMealType,
} from "@/components/shared/meal-types";

/**
 * Top-level dish confidence below this nudges the user to double-check the
 * review list before logging ("pork scanned as duck" territory).
 */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// Photo pipeline (save-time). The diary thumbnail is deliberately small:
// longest edge 320px at JPEG q0.65 lands around 15–40KB, so the list stays
// cheap on mobile data and the blob doubles as the offline cache entry.
// ---------------------------------------------------------------------------

const THUMB_MAX_EDGE = 320;
const THUMB_JPEG_QUALITY = 0.65;

/** Small JPEG blob from a preview data URL; null on any failure. */
async function thumbnailBlobFromDataUrl(dataUrl: string): Promise<Blob | null> {
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("THUMB_DECODE_FAILED"));
      img.src = dataUrl;
    });
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (width < 1 || height < 1) return null;

    const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", THUMB_JPEG_QUALITY);
    });
    return blob && blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/** Data URL → base64 payload for uploadMealPhoto. */
function dataUrlToBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}

/** Blob → raw base64 payload for uploadMealPhoto. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(dataUrlToBase64(String(reader.result)));
    reader.onerror = () => reject(new Error("THUMB_READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload the meal's thumbnail and prime the local photo cache. Best-effort
 * by design — without BLOB_READ_WRITE_TOKEN or on any network hiccup the
 * meal simply stays photoless, exactly like before this existed.
 */
async function attachMealPhoto(
  mealId: string,
  previewDataUrl: string,
): Promise<void> {
  try {
    const blob = await thumbnailBlobFromDataUrl(previewDataUrl);
    if (!blob) return;

    const { photoUrl } = await uploadMealPhoto(await blobToBase64(blob), mealId);
    if (!photoUrl) return;

    // Cache the same bytes we uploaded so the diary renders instantly.
    await cacheMealPhoto(mealId, blob);
  } catch {
    // Graceful degradation — never surface a photo problem after a save.
  }
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

  /**
   * Cancellation token for the in-flight analysis. Server actions can't be
   * aborted through the Next.js boundary (no AbortSignal on the invocation),
   * so cancelling bumps this counter: any result arriving from an earlier
   * run is discarded before it can touch state.
   */
  const analysisRunRef = useRef(0);

  const [phase, setPhase] = useState<"pick" | "analyzing" | "review">("pick");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  /** Last scan landed below LOW_CONFIDENCE_THRESHOLD — show the check banner. */
  const [lowConfidenceResult, setLowConfidenceResult] = useState(false);
  const [lowConfidenceDismissed, setLowConfidenceDismissed] = useState(false);
  /** Bumped to pop the first item's name into its inline editor. */
  const [renameFocusSignal, setRenameFocusSignal] = useState(0);
  const [drafts, setDrafts] = useState<DraftItem[]>([emptyDraftItem()]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [mealType, setMealType] = useState<MealType>(() => {
    const requested = searchParams.get("type");
    return isMealType(requested) ? requested : inferMealType();
  });

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || phase === "analyzing") return;

    // Claim this run; a later cancel bumps the counter and invalidates it.
    const runId = ++analysisRunRef.current;

    setPhase("analyzing");
    let prepared: PreparedAnalysisImage;
    try {
      prepared = await prepareAnalysisImage(file);
    } catch {
      if (analysisRunRef.current !== runId) return; // cancelled while decoding
      toast.error("Couldn't read that photo. Try taking another one.");
      setPhase("pick");
      return;
    }

    // The photo goes up immediately so the scanner has something real to
    // sweep over while the model works. Passthrough previews keep their
    // original encoding (Safari renders HEIC; other browsers just show the
    // dim overlay until review).
    setPhotoPreview(prepared.dataUrl);

    try {
      // Data URL (not bare base64) so the accurate sniffed media type
      // reaches the server; prefix-stripping servers are unaffected.
      const analysis = await analyzePhoto(prepared.dataUrl);
      if (analysisRunRef.current !== runId) return; // cancelled — discard
      setDrafts(analysis.items.map(draftFromAnalysis));
      setAnalysisFailed(false);
      // Banner state is per-scan: a fresh result re-arms it.
      setLowConfidenceResult(
        analysis.isFood &&
          analysis.confidence < LOW_CONFIDENCE_THRESHOLD &&
          analysis.items.length > 0,
      );
      setLowConfidenceDismissed(false);
    } catch (error) {
      if (analysisRunRef.current !== runId) return; // cancelled — discard
      // The photo itself was fine if it could be read at all — let the user
      // log by hand instead of losing the moment to a flaky model call.
      setDrafts([emptyDraftItem()]);
      setAnalysisFailed(true);
      setLowConfidenceResult(false);
      toast.error(describeActionError(error));
    }
    setPhase("review");
  }

  /**
   * Optimistic cancellation: the server action keeps running to completion
   * server-side (Next.js exposes no AbortSignal for action invocations),
   * but its result is discarded when it arrives late, the pickers come
   * back, and every analyzing timer dies with the ScanOverlay unmount.
   */
  function handleCancelAnalysis() {
    analysisRunRef.current += 1;
    resetToPick();
  }

  function updateDraft(index: number, patch: Partial<DraftItem>) {
    setDrafts((prev) =>
      prev.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    );
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function dismissLowConfidenceBanner() {
    setLowConfidenceDismissed(true);
  }

  /** Banner pencil affordance: open the first item's name for editing. */
  function focusFirstItemName() {
    setRenameFocusSignal((signal) => signal + 1);
  }

  async function handleSave() {
    const items = drafts.filter(isDraftMeaningful).map(draftToFoodItemInput);
    if (items.length === 0) {
      toast.error("Add at least one food with a name or calorie estimate.");
      return;
    }

    setSaving(true);
    try {
      const { mealId } = await saveMeal({
        mealType,
        note: note.trim() || undefined,
        items,
      });

      // Fire-and-forget: the meal is logged; the photo must never block or
      // fail the save (no token / offline / upload error → photoless meal).
      if (photoPreview) {
        void attachMealPhoto(mealId, photoPreview);
      }

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
    setLowConfidenceResult(false);
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

      {/* While analyzing the stage fills the viewport between the sticky
          top bar (pt-safe + min-h-14) and the fixed Cancel control below,
          so the scanner sits vertically centered on any phone height.
          Other phases keep their original flow. */}
      <main
        aria-busy={busy}
        className={
          phase === "analyzing"
            ? "mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] w-full max-w-md flex-col items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] py-4"
            : "mx-auto w-full max-w-md px-4 pt-safe pb-52"
        }
      >
        {phase === "pick" && (
          <PickCard
            disabled={busy}
            onCamera={() => cameraInputRef.current?.click()}
            onGallery={() => galleryInputRef.current?.click()}
          />
        )}

        {phase === "analyzing" && (
          <section aria-label="Analyzing your photo" className="reveal w-full space-y-5">
            <ScanOverlay preview={photoPreview} />
          </section>
        )}

        {phase === "review" && (
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
              <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">
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

            {lowConfidenceResult && !lowConfidenceDismissed && (
              <div
                role="status"
                className="reveal flex items-center gap-1.5 rounded-xl border border-carbs/30 bg-carbs/10 py-2 pr-1.5 pl-3"
                style={{ animationDelay: "90ms" }}
              >
                <TriangleAlertIcon
                  className="size-4 shrink-0 text-carbs"
                  aria-hidden="true"
                />
                <p className="min-w-0 flex-1 text-xs leading-relaxed">
                  Not sure about this one — double-check the items below.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="size-9 shrink-0 text-carbs"
                  aria-label="Check the first item's name"
                  onClick={focusFirstItemName}
                  disabled={saving}
                >
                  <PencilLineIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="size-9 shrink-0 text-muted-foreground"
                  aria-label="Dismiss this reminder"
                  onClick={dismissLowConfidenceBanner}
                  disabled={saving}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </div>
            )}

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
                focusFirstNameSignal={renameFocusSignal}
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

      {phase === "analyzing" && (
        <footer className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 w-full bg-card/95 text-base backdrop-blur"
            onClick={handleCancelAnalysis}
          >
            Cancel
          </Button>
        </footer>
      )}

      {phase === "review" && (
        <footer className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <div className="rounded-2xl border bg-card/95 p-3.5 backdrop-blur">
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

/** Idle entry: quiet plate mark, camera first, gallery second. */
function PickCard({
  disabled,
  onCamera,
  onGallery,
}: {
  disabled: boolean;
  onCamera: () => void;
  onGallery: () => void;
}) {
  return (
    <section
      className="reveal rounded-3xl border bg-card p-6"
      style={{ animationDelay: "0ms" }}
    >
      <div className="relative mx-auto grid size-28 place-items-center">
        <span aria-hidden="true" className="absolute inset-0 rounded-full ring-1 ring-border" />
        <span aria-hidden="true" className="absolute inset-3 rounded-full bg-accent/60" />
        <FlameIcon
          aria-hidden="true"
          className="size-9 text-primary"
          strokeWidth={1.8}
        />
      </div>

      <div className="mt-6 space-y-5">
        <div className="space-y-1.5 text-center">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Snap your plate
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            One clear photo is all calorAI needs to estimate calories and
            macros.
          </p>
        </div>

        <div className="space-y-2.5">
          <Button
            type="button"
            size="lg"
            className="h-11 w-full text-base"
            onClick={onCamera}
            disabled={disabled}
          >
            <CameraIcon aria-hidden="true" />
            Take photo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 w-full text-base"
            onClick={onGallery}
            disabled={disabled}
          >
            <ImagePlusIcon aria-hidden="true" />
            Choose from library
          </Button>
        </div>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Photos are analyzed to estimate nutrition and are kept only in your
          own diary.
        </p>
      </div>
    </section>
  );
}
