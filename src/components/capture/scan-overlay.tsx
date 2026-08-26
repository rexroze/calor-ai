"use client";

import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "@/components/shared/use-prefers-reduced-motion";

/**
 * Status copy shown while the vision model works — one tip every ~2.5s.
 * Reduced motion keeps a single steady line instead of a rotating one.
 */
const STATUS_TIPS = [
  "Detecting portions…",
  "Reading labels…",
  "Estimating macros…",
];

/**
 * Analyzing stage: the captured photo under a light dim with the coral
 * beam sweeping down and back up, a rotating status tip, and a subtle
 * tabular elapsed-seconds counter.
 *
 * This component is mounted only while a scan is in flight, so unmounting
 * it (scan completes, user cancels, or the whole flow unmounts) clears
 * every timer it owns — no orphaned intervals can outlive the analyzing
 * state by construction.
 */
export function ScanOverlay({ preview }: { preview: string | null }) {
  const reducedMotion = usePrefersReducedMotion();
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Rotate the tips. Reduced motion keeps one steady line instead.
  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setMessageIndex((i) => (i + 1) % STATUS_TIPS.length);
    }, 2500);
    return () => clearInterval(id);
  }, [reducedMotion]);

  // Elapsed counter — information, not motion, so it runs regardless of
  // the reduced-motion preference.
  useEffect(() => {
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <ScannerFrame preview={preview} reducedMotion={reducedMotion} />

      {/* min-h keeps layout steady as tips swap. The live region holds only
          the tip — the per-second counter must not spam screen readers. */}
      <div className="min-h-12 space-y-1 text-center">
        <div role="status" aria-live="polite">
          <p
            key={messageIndex}
            className={`text-base font-medium ${reducedMotion ? "" : "animate-status-in"}`}
          >
            {STATUS_TIPS[messageIndex]}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="tnum">{elapsedSeconds}s</span> elapsed · usually
          takes a couple of seconds
        </p>
      </div>
    </>
  );
}

/**
 * Cal-AI-style scanning frame: the photo stays visible under a light dim,
 * and a coral beam sweeps downward then back upward on one seamless loop
 * (.animate-scan-sweep-down-up), contained by the photo's radius. With
 * reduced motion there is no traveling beam at all — same static-dim
 * fallback as before.
 */
function ScannerFrame({
  preview,
  reducedMotion,
}: {
  preview: string | null;
  reducedMotion: boolean;
}) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl ring-1 ring-border">
      {preview ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={preview}
          alt="Your meal photo being analyzed"
          className="size-full object-cover"
        />
      ) : (
        <div className="size-full bg-card" aria-hidden="true" />
      )}

      {/* Reading dim — keeps the food visible, mutes it for the beam. */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/45" />

      {!reducedMotion && (
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <div className="animate-scan-sweep-down-up absolute inset-x-0 top-0 h-[26%]">
            <div
              className="size-full"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--primary) 14%) 48%, color-mix(in oklab, var(--primary) 36%) 82%, var(--primary))",
              }}
            >
              {/* Bright leading edge — crisp, never glowing. Flips with the
                  beam so it leads on the way up as well as the way down. */}
              <span
                className="absolute inset-x-0 bottom-0 h-[2px]"
                style={{
                  background:
                    "color-mix(in oklab, var(--primary) 55%, white)",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
