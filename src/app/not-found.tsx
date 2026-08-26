import Link from "next/link";
import type { Metadata } from "next";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

/** Branded 404 — sits outside the app shell, so it carries the brand itself. */
export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="app-backdrop" aria-hidden="true" />

      {/* Oversized ghost numeral behind the mark: depth without noise. */}
      <p
        aria-hidden="true"
        className="tnum pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[62%] font-display text-[11rem] leading-none font-semibold tracking-tighter text-primary/8 select-none"
      >
        404
      </p>

      <div className="reveal relative flex flex-col items-center gap-5">
        <BrandMark size="lg" />

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            This page wandered off the menu
          </h1>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
            The link may be old or mistyped. Everything you&apos;ve logged is
            safe and sound.
          </p>
        </div>

        <Button asChild size="lg" className="h-11 px-6 text-base">
          <Link href="/">Back to today</Link>
        </Button>
      </div>
    </main>
  );
}
