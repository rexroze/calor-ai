import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

/**
 * Shape-matched skeleton for Settings in section order: Appearance,
 * Daily goals, Account. Built from the real Card primitives so paddings,
 * radii and rings match the live screen exactly in both themes.
 */
export default function SettingsLoading() {
  return (
    <>
      <header className="sticky top-0 z-30 pt-safe">
        <div className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex min-h-14 w-full max-w-md items-center px-4 py-2">
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-md space-y-4 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]"
        aria-busy="true"
      >
        {/* Appearance */}
        <Card aria-hidden="true" className="reveal gap-5 py-6">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-full max-w-[17rem]" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {[0, 1, 2].map((seg) => (
                <Skeleton key={seg} className="h-11 rounded-lg" />
              ))}
            </div>
            <Skeleton className="mt-3 h-3 w-56" />
          </CardContent>
        </Card>

        {/* Daily goals */}
        <Card aria-hidden="true" className="reveal gap-5 py-6">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-full max-w-[15rem]" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((field) => (
                <div key={field} className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-4 h-11 w-full rounded-lg" />
          </CardContent>
        </Card>

        {/* Account */}
        <Card aria-hidden="true" className="reveal gap-5 py-6">
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </CardContent>
        </Card>

        <Skeleton className="mx-auto h-3 w-44" />
      </main>
    </>
  );
}
