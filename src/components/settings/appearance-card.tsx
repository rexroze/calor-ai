"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

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
      </CardContent>
    </Card>
  );
}
