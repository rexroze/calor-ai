"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { getProfile, saveProfile, recalculateTargets, type ProfileData } from "@/app/actions/profile";
import { describeActionError } from "@/components/shared/action-errors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.453592;
const INCHES_PER_FOOT = 12;

const SEX_OPTIONS: { value: "male" | "female"; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const ACTIVITY_OPTIONS: { value: string; label: string }[] = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "active", label: "Active" },
];

const GOAL_OPTIONS: { value: string; label: string }[] = [
  { value: "lose", label: "Lose" },
  { value: "maintain", label: "Maintain" },
  { value: "gain", label: "Gain" },
];

const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "metric", label: "Metric" },
  { value: "imperial", label: "Imperial" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert stored metric values to imperial display values. */
function cmToFeetInches(cm: number) {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = Math.round(totalInches % INCHES_PER_FOOT);
  return { feet, inches };
}

/** Convert imperial feet+inches back to stored cm. */
function feetInchesToCm(feet: number, inches: number): number {
  return (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH;
}

function kgToLbs(kg: number): number {
  return kg / KG_PER_LB;
}

function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}

// ---------------------------------------------------------------------------
// Segmented radio group (same pattern as AppearanceCard)
// ---------------------------------------------------------------------------

function SegmentedRadio({
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  name: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="flex w-full justify-center gap-1 rounded-xl bg-muted p-1"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex h-11 flex-1 items-center justify-center rounded-lg px-2 py-2 text-sm font-medium transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "bg-card text-foreground ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
              disabled && "opacity-50 pointer-events-none",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/** Personal-info settings card. Self-contained — fetches its own data. */
export function PersonalInfoCard() {
  const router = useRouter();

  // Profile fields
  const [sex, setSex] = useState<string | null>(null);
  const [age, setAge] = useState<string>("");
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [goalIntent, setGoalIntent] = useState<string | null>(null);
  const [unitPreference, setUnitPreference] = useState<string>("metric");

  // Metric values (always stored internally as metric)
  const [heightCm, setHeightCm] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");

  // Imperial display helpers
  const [heightFt, setHeightFt] = useState<string>("");
  const [heightIn, setHeightIn] = useState<string>("");
  const [weightLbs, setWeightLbs] = useState<string>("");

  // Loading states
  const [initialising, setInitialising] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Load profile on mount
  const [loadStarted, setLoadStarted] = useState(false);
  if (!loadStarted) {
    setLoadStarted(true);
    loadProfile();
  }

  async function loadProfile() {
    try {
      const data = await getProfile();
      applyProfileData(data);
    } catch {
      toast.error("Could not load profile");
    } finally {
      setInitialising(false);
    }
  }

  function applyProfileData(data: ProfileData) {
    setSex(data.sex);
    setAge(data.age != null ? String(data.age) : "");
    setActivityLevel(data.activityLevel);
    setGoalIntent(data.goalIntent);
    setUnitPreference(data.unitPreference);

    if (data.unitPreference === "imperial" && data.heightCm != null) {
      const { feet, inches } = cmToFeetInches(data.heightCm);
      setHeightFt(String(feet));
      setHeightIn(String(inches));
      setHeightCm("");
    } else {
      setHeightCm(data.heightCm != null ? String(Math.round(data.heightCm)) : "");
      setHeightFt("");
      setHeightIn("");
    }

    if (data.unitPreference === "imperial" && data.weightKg != null) {
      setWeightLbs(String(Math.round(kgToLbs(data.weightKg))));
      setWeightKg("");
    } else {
      setWeightKg(data.weightKg != null ? String(Math.round(data.weightKg)) : "");
      setWeightLbs("");
    }
  }

  // When unit preference changes, convert existing values
  function handleUnitChange(next: string) {
    const prev = unitPreference;
    if (next === prev) return;

    if (next === "imperial") {
      // Convert metric → imperial display
      const cm = parseNonNegative(heightCm);
      if (cm > 0) {
        const { feet, inches } = cmToFeetInches(cm);
        setHeightFt(String(feet));
        setHeightIn(String(inches));
      }
      setHeightCm("");

      const kg = parseNonNegative(weightKg);
      if (kg > 0) setWeightLbs(String(Math.round(kgToLbs(kg))));
      setWeightKg("");
    } else {
      // Convert imperial → metric display
      const ft = parseNonNegative(heightFt);
      const inch = parseNonNegative(heightIn);
      if (ft > 0 || inch > 0) {
        setHeightCm(String(Math.round(feetInchesToCm(ft, inch))));
      }
      setHeightFt("");
      setHeightIn("");

      const lbs = parseNonNegative(weightLbs);
      if (lbs > 0) setWeightKg(String(Math.round(lbsToKg(lbs))));
      setWeightLbs("");
    }

    setUnitPreference(next);
  }

  /** Collect current form state into a ProfileData shape for saving. */
  function collectProfileData(): ProfileData {
    let heightCmVal: number | null = null;
    let weightKgVal: number | null = null;

    if (unitPreference === "imperial") {
      const ft = parseNonNegative(heightFt);
      const inch = parseNonNegative(heightIn);
      if (ft > 0 || inch > 0) heightCmVal = feetInchesToCm(ft, inch);

      const lbs = parseNonNegative(weightLbs);
      if (lbs > 0) weightKgVal = lbsToKg(lbs);
    } else {
      const cm = parseNonNegative(heightCm);
      if (cm > 0) heightCmVal = cm;

      const kg = parseNonNegative(weightKg);
      if (kg > 0) weightKgVal = kg;
    }

    return {
      sex: sex as "male" | "female" | null,
      age: parseNonNegativeInt(age),
      heightCm: heightCmVal != null ? Math.round(heightCmVal * 100) / 100 : null,
      weightKg: weightKgVal != null ? Math.round(weightKgVal * 100) / 100 : null,
      activityLevel: (activityLevel as ProfileData["activityLevel"]) ?? null,
      goalIntent: (goalIntent as ProfileData["goalIntent"]) ?? null,
      unitPreference: unitPreference as "metric" | "imperial",
    };
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveProfile(collectProfileData());
      toast.success("Profile saved");
      router.refresh();
    } catch (error) {
      toast.error(describeActionError(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      // Save profile first so recalculateTargets has up-to-date data
      await saveProfile(collectProfileData());
      await recalculateTargets();
      toast.success("Targets recalculated from your profile");
      router.refresh();
    } catch (error) {
      toast.error(describeActionError(error));
    } finally {
      setRecalculating(false);
    }
  }

  const isImperial = unitPreference === "imperial";
  const busy = saving || recalculating;

  return (
    <Card className="reveal gap-5 py-6" style={{ animationDelay: "40ms" }}>
      <CardHeader>
        <CardTitle className="font-display text-lg tracking-tight">
          Personal Info
        </CardTitle>
        <CardDescription>
          Your body stats help us estimate accurate calorie and macro targets.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {initialising ? (
          <div className="space-y-4">
            <div className="h-9 animate-pulse rounded-xl bg-muted" />
            <div className="h-9 animate-pulse rounded-xl bg-muted" />
            <div className="h-9 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Unit preference toggle */}
            <section aria-label="Units">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Units
              </h3>
              <div className="mt-2.5 grid w-full grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                {UNIT_OPTIONS.map(({ value, label }) => {
                  const active = unitPreference === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      disabled={busy}
                      onClick={() => handleUnitChange(value)}
                      className={cn(
                        "flex h-9 min-h-11 items-center justify-center rounded-lg border px-2 py-2 text-sm font-medium transition-colors duration-150",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        active
                          ? "border-primary bg-card text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                        busy && "opacity-50 pointer-events-none",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Sex */}
            <section aria-label="Sex">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Sex
              </h3>
              <div className="mt-2.5">
                <SegmentedRadio
                  name="Sex"
                  value={sex}
                  options={SEX_OPTIONS}
                  onChange={setSex}
                  disabled={busy}
                />
              </div>
            </section>

            {/* Age */}
            <section aria-label="Age">
              <Label
                htmlFor="profile-age"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Age
              </Label>
              <Input
                id="profile-age"
                inputMode="numeric"
                autoComplete="off"
                min={13}
                max={99}
                placeholder="e.g. 30"
                value={age}
                onChange={(e) =>
                  setAge(e.target.value.replace(/[^\d]/g, "").slice(0, 2))
                }
                disabled={busy}
                className="mt-2.5 h-10 bg-background text-right tnum"
              />
            </section>

            {/* Height */}
            <section aria-label="Height">
              <Label
                htmlFor="profile-height-cm"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Height <span className="font-normal">({isImperial ? "ft/in" : "cm"})</span>
              </Label>
              {isImperial ? (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <Input
                      id="profile-height-ft"
                      inputMode="numeric"
                      autoComplete="off"
                      min={1}
                      max={8}
                      placeholder="ft"
                      value={heightFt}
                      onChange={(e) =>
                        setHeightFt(e.target.value.replace(/[^\d]/g, "").slice(0, 1))
                      }
                      disabled={busy}
                      className="h-10 bg-background text-center tnum"
                    />
                    <p className="text-center text-[10px] text-muted-foreground">ft</p>
                  </div>
                  <span className="pt-2 text-muted-foreground">·</span>
                  <div className="flex-1 space-y-1">
                    <Input
                      id="profile-height-in"
                      inputMode="numeric"
                      autoComplete="off"
                      min={0}
                      max={11}
                      placeholder="in"
                      value={heightIn}
                      onChange={(e) =>
                        setHeightIn(e.target.value.replace(/[^\d]/g, "").slice(0, 2))
                      }
                      disabled={busy}
                      className="h-10 bg-background text-center tnum"
                    />
                    <p className="text-center text-[10px] text-muted-foreground">in</p>
                  </div>
                </div>
              ) : (
                <Input
                  id="profile-height-cm"
                  inputMode="numeric"
                  autoComplete="off"
                  min={50}
                  max={300}
                  placeholder="e.g. 175"
                  value={heightCm}
                  onChange={(e) =>
                    setHeightCm(e.target.value.replace(/[^\d]/g, "").slice(0, 3))
                  }
                  disabled={busy}
                  className="mt-2.5 h-10 bg-background text-right tnum"
                />
              )}
            </section>

            {/* Weight */}
            <section aria-label="Weight">
              <Label
                htmlFor="profile-weight"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Weight <span className="font-normal">({isImperial ? "lbs" : "kg"})</span>
              </Label>
              <Input
                id="profile-weight"
                inputMode="numeric"
                autoComplete="off"
                min={20}
                max={500}
                placeholder={isImperial ? "e.g. 165" : "e.g. 75"}
                value={isImperial ? weightLbs : weightKg}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                  if (isImperial) setWeightLbs(val);
                  else setWeightKg(val);
                }}
                disabled={busy}
                className="mt-2.5 h-10 bg-background text-right tnum"
              />
            </section>

            {/* Activity level */}
            <section aria-label="Activity level">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Activity level
              </h3>
              <div className="mt-2.5">
                <SegmentedRadio
                  name="Activity"
                  value={activityLevel}
                  options={ACTIVITY_OPTIONS}
                  onChange={setActivityLevel}
                  disabled={busy}
                />
              </div>
            </section>

            {/* Goal intent */}
            <section aria-label="Goal">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Goal
              </h3>
              <div className="mt-2.5">
                <SegmentedRadio
                  name="Goal"
                  value={goalIntent}
                  options={GOAL_OPTIONS}
                  onChange={setGoalIntent}
                  disabled={busy}
                />
              </div>
            </section>

            {/* Actions */}
            <div className="space-y-3 pt-1">
              <Button
                type="submit"
                size="lg"
                className="h-11 w-full text-base"
                disabled={busy}
              >
                {saving ? (
                  <>
                    <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>

              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-11 w-full text-base"
                disabled={busy}
                onClick={handleRecalculate}
              >
                {recalculating ? (
                  <>
                    <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                    Recalculating…
                  </>
                ) : (
                  "Recalculate targets"
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function parseNonNegative(s: string): number {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseNonNegativeInt(s: string): number | null {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
