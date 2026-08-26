"use client";

import { useEffect } from "react";

/**
 * Owned by the PWA lane — registers /sw.js in production builds only.
 *
 * - SSR-safe: all browser work happens inside useEffect.
 * - Dev-safe: no-ops outside production (process.env is inlined at build time).
 * - Idempotent: a window-level guard prevents duplicate registrations, and
 *   register() itself is a no-op for an already-active scope/script pair.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const w = window as typeof window & { __caloraiSwRegisterRequested?: boolean };
    if (w.__caloraiSwRegisterRequested) return;
    w.__caloraiSwRegisterRequested = true;

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error: unknown) => {
          console.error("[calorAI] service worker registration failed:", error);
        });
    };

    // Wait for window load so the SW never competes with critical resources.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
