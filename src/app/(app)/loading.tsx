import { Skeleton } from "@/components/ui/skeleton";

/** Shape-matched skeleton for the Today screen so the swap feels continuous. */
export default function TodayLoading() {
  return (
    <>
      {/* Fake TopBar: date navigator pill row. */}
      <header className="sticky top-0 z-30 pt-safe">
        <div className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex min-h-14 w-full max-w-md items-center justify-between px-4 py-2">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="size-10 rounded-full" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
        <div
          aria-hidden="true"
          className="rounded-3xl border bg-card p-5 pb-6 shadow-sm"
        >
          <Skeleton className="mx-auto size-[224px] rounded-full" />
          <div className="mt-6 space-y-4 border-t border-border/60 pt-5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-7 space-y-5">
          <Skeleton className="h-4 w-20 px-1" />
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            {[0, 1].map((row) => (
              <div
                key={row}
                className="flex min-h-[4.5rem] items-center gap-3 border-b border-border/70 px-3 py-3 last:border-b-0"
              >
                <Skeleton className="size-11 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
