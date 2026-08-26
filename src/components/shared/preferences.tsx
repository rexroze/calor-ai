"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { Units } from "@/components/shared/units";

/**
 * Client-side user preferences: UNITS (metric | imperial) and GENTLE MODE
 * (hide calorie numbers). Mirrors the calorai-theme localStorage pattern:
 *
 * - Source of truth on the client is `document.documentElement.dataset`
 *   (`data-units`, `data-gentle`), written by the inline pre-paint bootstrap
 *   script in app/layout.tsx BEFORE first paint, so nothing ever renders
 *   stale units or unwanted calorie numbers.
 * - localStorage (`calorai-units`: "metric"|"imperial"; `calorai-gentle`:
 *   "1"|"0") persists the choice; absence means the defaults metric / off.
 * - Setters write localStorage + dataset, then dispatch the custom
 *   "calorai-prefs-changed" window event that every consumer subscribes to.
 *
 * Hydration safety: useSyncExternalStore's getServerSnapshot is used during
 * hydration, so the first client render matches the server markup exactly
 * (defaults); React then re-checks the live snapshot right after hydration
 * and updates synchronously — no mismatch errors, no useEffect flash.
 */

export const UNITS_STORAGE_KEY = "calorai-units";
export const GENTLE_STORAGE_KEY = "calorai-gentle";
export const PREFS_CHANGED_EVENT = "calorai-prefs-changed";

function subscribeToPrefs(onChange: () => void) {
  window.addEventListener(PREFS_CHANGED_EVENT, onChange);
  // Cross-tab sync falls out of the storage event for free.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PREFS_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getUnitsSnapshot(): Units {
  const attr = document.documentElement.dataset.units;
  if (attr === "imperial") return "imperial";
  if (attr === "metric") return "metric";
  // Attribute missing (bootstrap blocked, private mode): honor stored choice.
  try {
    return window.localStorage.getItem(UNITS_STORAGE_KEY) === "imperial"
      ? "imperial"
      : "metric";
  } catch {
    return "metric";
  }
}

function getGentleSnapshot(): boolean {
  const attr = document.documentElement.dataset.gentle;
  if (attr === "1") return true;
  if (attr === "0") return false;
  try {
    return window.localStorage.getItem(GENTLE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const getServerUnits = (): Units => "metric";
const getServerGentle = (): boolean => false;

/** Current unit system + setter. Defaults to "metric". */
export function useUnits(): [Units, (units: Units) => void] {
  const units = useSyncExternalStore(
    subscribeToPrefs,
    getUnitsSnapshot,
    getServerUnits,
  );

  const setUnits = useCallback((next: Units) => {
    try {
      window.localStorage.setItem(UNITS_STORAGE_KEY, next);
    } catch {
      // Storage unavailable — apply for this session only.
    }
    document.documentElement.dataset.units = next;
    window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT));
  }, []);

  return [units, setUnits];
}

/** Gentle mode (hide calorie numbers) + setter. Defaults to off. */
export function useGentle(): [boolean, (gentle: boolean) => void] {
  const gentle = useSyncExternalStore(
    subscribeToPrefs,
    getGentleSnapshot,
    getServerGentle,
  );

  const setGentle = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(GENTLE_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage unavailable — apply for this session only.
    }
    document.documentElement.dataset.gentle = next ? "1" : "0";
    window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT));
  }, []);

  return [gentle, setGentle];
}
