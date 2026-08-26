"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { saveGoals } from "@/app/actions/goals";
import { describeActionError } from "@/components/shared/action-errors";
import { parseNonNegative } from "@/components/shared/format";
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
import type { Goals } from "@/lib/contracts";
import { cn } from "@/lib/utils";

/** Server-side caps (goals action schema) mirrored so inputs clamp politely. */
const FIELD_LIMITS = {
  calories: 20000,
  proteinG: 2000,
  carbsG: 4000,
  fatG: 2000,
} as const;

const FIELDS: {
  key: keyof Goals & keyof typeof FIELD_LIMITS;
  label: string;
  unit: string;
  dotClass?: string;
}[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g", dotClass: "bg-protein" },
  { key: "carbsG", label: "Carbs", unit: "g", dotClass: "bg-carbs" },
  { key: "fatG", label: "Fat", unit: "g", dotClass: "bg-fat" },
];

export function GoalsForm({ initialGoals }: { initialGoals: Goals }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<keyof Goals, string>>({
    calories: String(initialGoals.calories),
    proteinG: String(initialGoals.proteinG),
    carbsG: String(initialGoals.carbsG),
    fatG: String(initialGoals.fatG),
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = Object.fromEntries(
      FIELDS.map(({ key }) => [
        key,
        Math.min(
          FIELD_LIMITS[key],
          Math.round(parseNonNegative(values[key])),
        ),
      ]),
    ) as Goals;

    setSaving(true);
    try {
      await saveGoals(next);
      toast.success("Daily goals updated");
      router.refresh();
    } catch (error) {
      toast.error(describeActionError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="reveal gap-5 py-6">
      <CardHeader>
        <CardTitle className="font-display text-lg tracking-tight">
          Daily goals
        </CardTitle>
        <CardDescription>
          The targets your ring and macro bars are measured against.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(({ key, label, unit, dotClass }) => (
              <div key={key} className="space-y-1.5">
                <Label
                  htmlFor={`goal-${key}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  {dotClass && (
                    <span
                      aria-hidden="true"
                      className={cn("size-1.5 rounded-full", dotClass)}
                    />
                  )}
                  {label}
                  <span className="font-normal">({unit})</span>
                </Label>
                <Input
                  id={`goal-${key}`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={values[key]}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      [key]: event.target.value.replace(/[^\d]/g, ""),
                    }))
                  }
                  disabled={saving}
                  className="tnum h-10 bg-background text-right"
                />
              </div>
            ))}
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full text-base"
            disabled={saving}
          >
            {saving ? (
              <>
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Save goals"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
