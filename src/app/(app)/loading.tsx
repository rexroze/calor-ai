import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shape-matched skeleton for Today: same paddings, ring diameter, bar
 * heights and meal-row heights as the live screen, so the swap is seamless.
 * Colors come from theme tokens — correct in dark and light.
 */
export default function TodayLoading() {
  return (
    <>
      {/* TopBar: navigator chrome + greeting-sized center block. */}
      <header className="sticky top-0 z-30 pt-safe">
        <div className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex min-h-14 w-full max-w-md items-center justify-between px-4 py-2">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="size-10 shrink-0 rounded-full opacity-40" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
        {/* Hero card: p-5 pb-6, 224px ring, divider, three macro rows. */}
        <div aria-hidden="true" className="rounded-3xl border bg-card p-5 pb-6">
          <Skeleton className="mx-auto size-[224px] rounded-full" />
          <div className="mt-6 space-y-4 border-t border-border/60 pt-5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="mt-1.5 h-1.5 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Meals section: header, group header, one group of two rows. */}
        <div aria-hidden="true" className="mt-7 space-y-5">
          <Skeleton className="h-3 w-20" />

          <div>
            <div className="flex items-baseline justify-between px-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="mt-2 divide-y divide-border/70 overflow-hidden rounded-2xl border bg-card">
              {[0, 1].map((row) => (
                <div
                  key={row}
                  className="flex min-h-[4.5rem] items-center gap-3 px-3 py-3"
                >
                  <Skeleton className="size-11 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className={row === 0 ? "h-4 w-36" : "h-4 w-28"} />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-9 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
