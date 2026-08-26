import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shape-matched skeleton for the meal editor: title block, meal/note fields,
 * one review item card and the fixed totals+actions deck. Heights match the
 * live controls (h-10 selects, h-9 macro minis, h-11 deck buttons).
 */
export default function MealLoading() {
  return (
    <>
      <header className="sticky top-0 z-30 pt-safe">
        <div className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex min-h-14 w-full max-w-md items-center px-4 py-2">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 justify-center">
              <Skeleton className="h-5 w-28" />
            </div>
            <span aria-hidden="true" className="size-10 shrink-0" />
          </div>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-md px-4 pt-safe pb-56"
        aria-busy="true"
      >
        <div aria-hidden="true" className="space-y-5">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-56" />
          </div>

          {/* Meal type + note */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-[74px] w-full rounded-lg" />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <Skeleton className="h-3 w-12" />
            <div className="space-y-3 rounded-2xl border bg-card p-3">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[0, 1, 2, 3].map((mini) => (
                  <div key={mini} className="space-y-1">
                    <Skeleton className="mx-auto h-2 w-10" />
                    <Skeleton className="h-9 w-full rounded-lg" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        </div>
      </main>

      {/* Fixed action deck */}
      <footer
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <div className="rounded-2xl border bg-card/95 p-3.5 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-8" />
            </div>
            <div className="flex items-center gap-3">
              {[0, 1, 2].map((stat) => (
                <Skeleton key={stat} className="h-6 w-8" />
              ))}
            </div>
          </div>
          <div className="my-3 h-px bg-border" />
          <div className="flex gap-2.5">
            <Skeleton className="size-11 shrink-0 rounded-lg" />
            <Skeleton className="h-11 flex-1 rounded-lg" />
          </div>
        </div>
      </footer>
    </>
  );
}
