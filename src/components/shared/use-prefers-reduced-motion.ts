"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
let media: MediaQueryList | null = null;

function getMedia(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  if (!media) media = window.matchMedia(QUERY);
  return media;
}

function subscribe(onChange: () => void): () => void {
  const m = getMedia();
  if (!m) return () => {};
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}

/**
 * Reactive prefers-reduced-motion. Server snapshot is false; the client
 * snapshot corrects immediately after hydration without effects.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getMedia()?.matches ?? false,
    () => false,
  );
}
