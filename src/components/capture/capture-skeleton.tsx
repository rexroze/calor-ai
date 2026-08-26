import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shape-matched skeleton for the capture pick screen: plate mark circle,
 * heading/copy block, two full-width 44px buttons, footnote.
 * Shared by capture/loading.tsx and the page's Suspense fallback so both
 * routes and islands show identical chrome while loading.
 */
export function CaptureSkeleton() {
  return (
    <main
      className="mx-auto w-full max-w-md px-4 pt-safe pb-52"
      aria-busy="true"
    >
      <div aria-hidden="true" className="rounded-3xl border bg-card p-6">
        <div className="relative mx-auto grid size-28 place-items-center">
          <Skeleton className="absolute inset-0 rounded-full" />
          <Skeleton className="absolute inset-3 rounded-full opacity-60" />
          <Skeleton className="size-9 rounded-lg" />
        </div>

        <div className="mt-6 space-y-5">
          <div className="space-y-2 text-center">
            <Skeleton className="mx-auto h-6 w-40" />
            <Skeleton className="mx-auto h-4 w-full max-w-[16rem]" />
          </div>

          <div className="space-y-2.5">
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>

          <Skeleton className="mx-auto h-3 w-48" />
        </div>
      </div>
    </main>
  );
}
