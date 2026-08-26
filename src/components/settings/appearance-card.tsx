"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { useGentle, useUnits } from "@/components/shared/preferences";
import type { Units } from "@/components/shared/units";
import {
  ThemeProvider,
  useTheme,
  type ThemeChoice,
} from "@/components/theme/theme-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: ThemeChoice;
  label: string;
  Icon: typeof MoonIcon;
}[] = [
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

const UNIT_CHOICES: { value: Units; label: string }[] = [
  { value: "metric", label: "Metric" },
  { value: "imperial", label: "Imperial" },
];

/** Dark / Light / System segmented control, persisted to localStorage. */
export function AppearanceCard() {
  return (
    <ThemeProvider>
      <AppearanceCardBody />
    </ThemeProvider>
  );
}

function AppearanceCardBody() {
  const { theme, setTheme } = useTheme();
  const [units, setUnits] = useUnits();
  const [gentle, setGentle] = useGentle();

  return (
    <Card className="reveal gap-5 py-6">
      <CardHeader>
        <CardTitle className="font-display text-lg tracking-tight">
          Appearance
        </CardTitle>
        <CardDescription>
          Dark keeps photos vivid and evenings calm; System follows your
          device.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div
          role="radiogroup"
          aria-label="Appearance"
          className="grid w-full grid-cols-3 gap-1 rounded-xl bg-muted p-1"
        >
          {OPTIONS.map(({ value, label, Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex h-9 min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "bg-card text-foreground ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Your choice stays on this device and applies instantly everywhere.
        </p>

        {/* Units + gentle mode: same visual language as the theme control. */}
        <div className="mt-5 space-y-5 border-t border-border/60 pt-5">
          <section aria-label="Units">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Units
            </h3>
            <div
              role="group"
              aria-label="Units"
              className="mt-2.5 grid w-full grid-cols-2 gap-1 rounded-xl bg-muted p-1"
            >
              {UNIT_CHOICES.map(({ value, label }) => {
                const active = units === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setUnits(value)}
                    className={cn(
                      "flex h-9 min-h-11 items-center justify-center rounded-lg border px-2 py-2 text-sm font-medium transition-colors duration-150",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      active
                        ? "border-primary bg-card text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Metric shows grams and millilitres; Imperial shows pounds and
              ounces. Your goals stay metric behind the scenes.
            </p>
          </section>

          <section aria-label="Gentle mode">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <div className="min-w-0">
                <Label
                  htmlFor="gentle-mode"
                  className="text-sm font-medium text-foreground"
                >
                  Hide calorie numbers
                </Label>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Shows progress without focusing on numbers
                </p>
              </div>
              <Switch
                id="gentle-mode"
                checked={gentle}
                onCheckedChange={setGentle}
                aria-label="Hide calorie numbers"
              />
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
