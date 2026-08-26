import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shape-matched skeleton for the auth card: brand mark, heading, two 44px
 * fields, submit button, cross-link line. Shared by /signin and /signup.
 */
export function AuthSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-hidden="true"
      className="w-full max-w-sm space-y-6 rounded-3xl border bg-card px-6 py-8"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-14 rounded-xl" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>

      <Skeleton className="mx-auto h-4 w-48" />
    </div>
  );
}
