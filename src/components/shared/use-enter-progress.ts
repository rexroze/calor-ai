"use client";

import { useEffect, useState } from "react";

/**
 * Returns 0 immediately after mount, then the real ratio one frame later so
 * CSS transitions on width/stroke-dashoffset animate the entrance.
 * Honors prefers-reduced-motion by jumping straight to the final value.
 */
export function useEnterProgress(ratio: number): number {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Both paths flip state inside a rAF callback (not synchronously in the
    // effect body) so the initial paint commits before the transition runs.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      if (media.matches) {
        setEntered(true);
        return;
      }
      // Double rAF guarantees the first frame rendered at 0 before animating.
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  return entered ? Math.max(0, Math.min(1, ratio)) : 0;
}
