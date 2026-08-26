"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveGoals } from "@/app/actions/goals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeTargets,
  type ActivityLevel,
  type GoalIntent,
  type Sex,
} from "@/lib/targets";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 3;

const ACTIVITY_OPTIONS: Array<{
  value: ActivityLevel;
  label: string;
  hint: string;
}> = [
  { value: "sedentary", label: "Sedentary", hint: "Mostly sitting · ×1.2" },
  { value: "light", label: "Lightly active", hint: "Light movement · ×1.375" },
  { value: "moderate", label: "Moderately active", hint: "Active days · ×1.55" },
  { value: "active", label: "Very active", hint: "Hard training · ×1.725" },
];

const INTENT_OPTIONS: Array<{
  value: GoalIntent;
  label: string;
  hint: string;
}> = [
  { value: "lose", label: "Lose weight", hint: "≈0.5 kg down per week" },
  { value: "maintain", label: "Maintain", hint: "Stay at your current weight" },
  { value: "gain", label: "Gain muscle", hint: "Lean surplus for building" },
];

/** Plan fields as editable strings — the input's source of truth. */
type PlanValues = {
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

const PLAN_LIMITS = {
  calories: 20_000,
  proteinG: 2_000,
  carbsG: 4_000,
  fatG: 2_000,
} as const;

function clampRound(value: string, max: number): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(0, Math.round(parsed)));
}

/**
 * Post-signup wizard: three steps (welcome → about you → goal), each with a
 * persistent skip path. The plan panel on step 3 is prefilled by
 * computeTargets and stays fully editable before saving.
 */
export function OnboardingWizard({ displayName }: { displayName: string }) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [intent, setIntent] = useState<GoalIntent>("maintain");
  const [plan, setPlan] = useState<PlanValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const firstName = displayName.trim().split(/\s+/)[0];

  const ageNum = Number(age);
  const heightNum = Number(heightCm);
  const weightNum = Number(weightKg);
  const statsValid =
    sex !== null &&
    Number.isInteger(ageNum) &&
    ageNum >= 13 &&
    ageNum <= 99 &&
    heightNum >= 100 &&
    heightNum <= 250 &&
    weightNum >= 30 &&
    weightNum <= 300 &&
    activity !== null;

  /** Recompute the plan panel from the current stats + intent. */
  function recomputePlan(forIntent: GoalIntent) {
    if (!statsValid || sex === null || activity === null) return;
    const targets = computeTargets({
      sex,
      age: ageNum,
      heightCm: heightNum,
      weightKg: weightNum,
      activity,
      intent: forIntent,
    });
    setPlan({
      calories: String(targets.calories),
      proteinG: String(targets.proteinG),
      carbsG: String(targets.carbsG),
      fatG: String(targets.fatG),
    });
  }

  function selectIntent(next: GoalIntent) {
    setIntent(next);
    setError(null);
    // Fresh math per intent; any manual overrides reset so the panel always
    // reflects the selected goal until the user edits again.
    recomputePlan(next);
  }

  /** Enter-to-advance within steps; validates the active step first. */
  function handleAdvance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (step === 1) {
      if (sex === null || activity === null) {
        setError("Pick an option for each question to continue.");
        return;
      }
      if (!Number.isInteger(ageNum) || ageNum < 13 || ageNum > 99) {
        setError("Age must be a whole number between 13 and 99.");
        return;
      }
      if (!Number.isFinite(heightNum) || heightNum < 100 || heightNum > 250) {
        setError("Height must be between 100 and 250 cm.");
        return;
      }
      if (!Number.isFinite(weightNum) || weightNum < 30 || weightNum > 300) {
        setError("Weight must be between 30 and 300 kg.");
        return;
      }
      // Arriving on step 3 seeds the plan from fresh math.
      recomputePlan(intent);
    }

    setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1));
  }

  async function handleStartTracking() {
    if (saving || !plan) return;

    const calories = clampRound(plan.calories, PLAN_LIMITS.calories);
    const proteinG = clampRound(plan.proteinG, PLAN_LIMITS.proteinG);
    const carbsG = clampRound(plan.carbsG, PLAN_LIMITS.carbsG);
    const fatG = clampRound(plan.fatG, PLAN_LIMITS.fatG);
    if (
      calories === null ||
      proteinG === null ||
      carbsG === null ||
      fatG === null
    ) {
      setError("Your plan needs valid numbers — check the highlighted values.");
      return;
    }

    setSaving(true);
    try {
      await saveGoals({ calories, proteinG, carbsG, fatG });
      toast.success("You're all set");
      router.replace("/");
      // Sync server-rendered session state behind the navigation.
      router.refresh();
    } catch {
      toast.error("Couldn't save your targets. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5">
      {/* Progress dots */}
      <div
        className="flex items-center gap-2"
        role="group"
        aria-label={`Step ${step + 1} of ${TOTAL_STEPS}`}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              index === step
                ? "w-6 bg-primary"
                : index < step
                  ? "w-2 bg-primary/40"
                  : "w-2 bg-border",
            )}
          />
        ))}
      </div>

      <Card className="reveal w-full gap-6 rounded-3xl border bg-card py-8">
        <CardContent className="px-6">
          <div key={step} className="reveal space-y-6">
            {step === 0 && (
              <form onSubmit={handleAdvance}>
                <StepWelcome firstName={firstName} />
                <WizardActions
                  showBack={false}
                  continueLabel="Let's go"
                  onBack={() => setStep(0)}
                  saving={saving}
                />
              </form>
            )}

            {step === 1 && (
              <form onSubmit={handleAdvance}>
                <StepAboutYou
                  sex={sex}
                  onSexChange={(next) => {
                    setSex(next);
                    setError(null);
                  }}
                  age={age}
                  onAgeChange={setAge}
                  heightCm={heightCm}
                  onHeightChange={setHeightCm}
                  weightKg={weightKg}
                  onWeightChange={setWeightKg}
                  activity={activity}
                  onActivityChange={(next) => {
                    setActivity(next);
                    setError(null);
                  }}
                />
                {error && <FormError message={error} />}
                <WizardActions
                  showBack
                  continueLabel="Continue"
                  onBack={() => setStep(0)}
                  saving={saving}
                />
              </form>
            )}

            {step === 2 && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleStartTracking();
                }}
              >
                <StepGoal
                  intent={intent}
                  onIntentChange={selectIntent}
                  plan={plan}
                  onPlanChange={setPlan}
                  maintenance={
                    statsValid && sex !== null && activity !== null
                      ? computeTargets({
                          sex,
                          age: ageNum,
                          heightCm: heightNum,
                          weightKg: weightNum,
                          activity,
                          intent,
                        }).tdee
                      : null
                  }
                />
                {error && <FormError message={error} />}
                <WizardActions
                  showBack
                  continueLabel="Start tracking"
                  onBack={() => setStep(1)}
                  saving={saving}
                />
              </form>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Persistent escape hatch — defaults stay active server-side. */}
      <button
        type="button"
        onClick={() => router.replace("/")}
        className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Skip for now
      </button>
    </div>
  );
}

// ---------- Step bodies ----------

function StepWelcome({ firstName }: { firstName: string }) {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <h1 className="font-display text-xl font-semibold tracking-tight">
        Let&apos;s set up your targets{firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="text-sm text-muted-foreground">
        A few quick questions so calorAI can estimate your daily calories and
        macros — everything is adjustable later.
      </p>
    </header>
  );
}

function StepAboutYou({
  sex,
  onSexChange,
  age,
  onAgeChange,
  heightCm,
  onHeightChange,
  weightKg,
  onWeightChange,
  activity,
  onActivityChange,
}: {
  sex: Sex | null;
  onSexChange: (value: Sex) => void;
  age: string;
  onAgeChange: (value: string) => void;
  heightCm: string;
  onHeightChange: (value: string) => void;
  weightKg: string;
  onWeightChange: (value: string) => void;
  activity: ActivityLevel | null;
  onActivityChange: (value: ActivityLevel) => void;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          About you
        </h2>
        <p className="text-sm text-muted-foreground">
          Used only to estimate your energy needs.
        </p>
      </header>

      <fieldset className="space-y-2">
        <legend className="pb-1 text-sm font-medium">Sex</legend>
        <div className="grid grid-cols-2 gap-2.5">
          <RadioCard
            name="onboarding-sex"
            checked={sex === "male"}
            onChange={() => onSexChange("male")}
            label="Male"
          />
          <RadioCard
            name="onboarding-sex"
            checked={sex === "female"}
            onChange={() => onSexChange("female")}
            label="Female"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="pb-1 text-sm font-medium">Activity level</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {ACTIVITY_OPTIONS.map((option) => (
            <RadioCard
              key={option.value}
              name="onboarding-activity"
              checked={activity === option.value}
              onChange={() => onActivityChange(option.value)}
              label={option.label}
              hint={option.hint}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-2.5">
        <NumberField
          id="onboarding-age"
          label="Age"
          unit="yrs"
          value={age}
          onChange={onAgeChange}
          min={13}
          max={99}
          placeholder="28"
        />
        <NumberField
          id="onboarding-height"
          label="Height"
          unit="cm"
          value={heightCm}
          onChange={onHeightChange}
          min={100}
          max={250}
          placeholder="175"
        />
        <NumberField
          id="onboarding-weight"
          label="Weight"
          unit="kg"
          value={weightKg}
          onChange={onWeightChange}
          min={30}
          max={300}
          placeholder="75"
        />
      </div>
    </div>
  );
}

function StepGoal({
  intent,
  onIntentChange,
  plan,
  onPlanChange,
  maintenance,
}: {
  intent: GoalIntent;
  onIntentChange: (value: GoalIntent) => void;
  plan: PlanValues | null;
  onPlanChange: (values: PlanValues) => void;
  /** Estimated maintenance kcal — null until stats are complete. */
  maintenance: number | null;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Your goal
        </h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ll shape your daily target around it.
        </p>
      </header>

      <fieldset className="space-y-2.5" role="radiogroup" aria-label="Goal">
        {INTENT_OPTIONS.map((option) => {
          const delta =
            option.value === "lose"
              ? "−500 kcal/day"
              : option.value === "gain"
                ? "+250 kcal/day"
                : "±0 kcal/day";
          return (
            <RadioCard
              key={option.value}
              name="onboarding-intent"
              checked={intent === option.value}
              onChange={() => onIntentChange(option.value)}
              label={option.label}
              hint={option.hint}
              trailing={<span className="tnum text-xs">{delta}</span>}
            />
          );
        })}
      </fieldset>

      <section className="rounded-2xl border bg-muted/30 p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium">Your daily plan</h3>
          <span className="text-xs text-muted-foreground">Edit anything</span>
        </div>

        {maintenance !== null && (
          <p className="tnum mb-3 text-xs text-muted-foreground">
            Estimated maintenance ≈{" "}
            {Math.round(maintenance).toLocaleString("en-US")} kcal/day
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <PlanField
            id="plan-calories"
            label="Calories"
            unit="kcal"
            value={plan?.calories ?? ""}
            onChange={(value) =>
              onPlanChange({ ...(plan ?? emptyPlan()), calories: value })
            }
          />
          <PlanField
            id="plan-protein"
            label="Protein"
            unit="g"
            value={plan?.proteinG ?? ""}
            onChange={(value) =>
              onPlanChange({ ...(plan ?? emptyPlan()), proteinG: value })
            }
          />
          <PlanField
            id="plan-carbs"
            label="Carbs"
            unit="g"
            value={plan?.carbsG ?? ""}
            onChange={(value) =>
              onPlanChange({ ...(plan ?? emptyPlan()), carbsG: value })
            }
          />
          <PlanField
            id="plan-fat"
            label="Fat"
            unit="g"
            value={plan?.fatG ?? ""}
            onChange={(value) =>
              onPlanChange({ ...(plan ?? emptyPlan()), fatG: value })
            }
          />
        </div>
      </section>
    </div>
  );
}

function emptyPlan(): PlanValues {
  return { calories: "", proteinG: "", carbsG: "", fatG: "" };
}

// ---------- Shared pieces ----------

function WizardActions({
  showBack,
  continueLabel,
  onBack,
  saving,
}: {
  showBack: boolean;
  continueLabel: string;
  onBack: () => void;
  saving: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2.5 pt-1">
      {showBack ? (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={saving}
          className="h-11 w-12"
          aria-label="Back"
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Button>
      ) : null}
      <Button type="submit" disabled={saving} className="h-11 w-full text-base">
        {continueLabel}
        {!saving && <ArrowRightIcon aria-hidden="true" />}
      </Button>
    </div>
  );
}

function RadioCard({
  name,
  checked,
  onChange,
  label,
  hint,
  trailing,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-start justify-between gap-2 rounded-xl border p-3 transition-colors",
        "has-[:checked]:border-primary has-[:checked]:bg-primary/5",
        "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        !checked && "hover:border-muted-foreground/30",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
        required
      />
      <CheckIcon
        aria-hidden="true"
        className="absolute right-2 top-2 size-3.5 text-primary opacity-0 transition-opacity peer-checked:opacity-100"
      />
      <span className="min-w-0 flex-1">
        <span className="block pr-5 text-sm leading-snug font-medium">
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      {trailing && (
        <span className="pt-0.5 text-right text-muted-foreground">
          {trailing}
        </span>
      )}
    </label>
  );
}

function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label} <span aria-hidden="true">·</span> {unit}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="tnum h-11"
      />
    </div>
  );
}

function PlanField({
  id,
  label,
  unit,
  value,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label} <span aria-hidden="true">·</span> {unit}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="tnum h-11 font-medium"
      />
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}
