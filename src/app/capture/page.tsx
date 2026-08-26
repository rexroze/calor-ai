import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { CaptureFlow } from "@/components/capture/capture-flow";
import { CaptureSkeleton } from "@/components/capture/capture-skeleton";
import { TopBar } from "@/components/top-bar";

export const metadata: Metadata = {
  title: "Log a meal",
};

/**
 * Focus-mode screen, deliberately outside the (app) tab shell so the save
 * bar owns the bottom edge. useSearchParams (?type=) requires the island to
 * sit behind a Suspense boundary.
 */
export default function CapturePage() {
  return (
    <div className="relative min-h-dvh">
      <div className="app-backdrop" aria-hidden="true" />

      <TopBar>
        <BackLink />
        <h1 className="flex-1 text-center font-display text-lg font-semibold tracking-tight">
          Log a meal
        </h1>
        {/* Balances the back button so the title stays optically centered. */}
        <span aria-hidden="true" className="size-11 shrink-0" />
      </TopBar>

      <Suspense fallback={<CaptureSkeleton />}>
        <CaptureFlow />
      </Suspense>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      aria-label="Back to today"
      className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ArrowLeftIcon className="size-5" aria-hidden="true" />
    </Link>
  );
}
