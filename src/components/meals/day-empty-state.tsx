import Link from "next/link";
import { CameraIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Warm, unhurried empty state for a day with nothing logged. On past days
 * the capture CTA is hidden — snapping now would land the meal on today.
 */
export function DayEmptyState({ isToday }: { isToday: boolean }) {
  return (
    <section
      className="reveal mt-6 rounded-3xl border border-dashed border-primary/35 bg-card/70 px-6 py-10 text-center"
      aria-label="No meals logged"
    >
      {/* Decorative plate: two soft rings around a single tine of pasta. */}
      <div aria-hidden="true" className="relative mx-auto grid size-24 place-items-center">
        <span className="absolute inset-0 rounded-full border border-primary/25" />
        <span className="absolute inset-3 rounded-full bg-accent/50" />
        <svg viewBox="0 0 48 48" fill="none" className="size-10">
          <path
            d="M14 30c0-7 4.5-12 10-12s10 5 10 12H14Z"
            className="fill-primary"
            opacity={0.85}
          />
          <path
            d="M24 18v-6m-5 6.8-2.2-5.4m12.2 5.4L31.2 12.6"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            className="text-primary"
            opacity={0.55}
          />
        </svg>
      </div>

      <h2 className="font-display mt-5 text-lg font-semibold tracking-tight">
        Nothing logged yet
      </h2>
      <p className="mx-auto mt-1.5 max-w-[17rem] text-sm leading-relaxed text-muted-foreground">
        {isToday
          ? "Snap your next plate and calorAI will estimate the calories and macros for you."
          : "This day stayed empty. Only today can take new photos."}
      </p>

      {isToday && (
        <Button asChild size="lg" className="mt-6 h-11 px-6 text-base">
          <Link href="/capture">
            <CameraIcon aria-hidden="true" />
            Snap a meal
          </Link>
        </Button>
      )}
    </section>
  );
}
