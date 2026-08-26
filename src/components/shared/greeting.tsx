"use client";

import { useEffect, useState } from "react";

import { useSession } from "@/lib/auth-client";

function timeBucket(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 5) return "evening";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Email handle before a dot or @, capitalized — better than no name. */
function displayName(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const raw = (name ?? "").trim() || email?.split(/[.@]/)[0] || "";
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Time-aware, personalized center slot for the Today top bar:
 *   Good evening,
 *   Rex
 *
 * Hydration-safe: the time-of-day and session are read only after mount, so
 * server and first client render agree on an empty reserved block that then
 * fades in — no mismatch, no layout shift.
 */
export function Greeting() {
  const { data: session, isPending } = useSession();
  const [bucket, setBucket] = useState<"morning" | "afternoon" | "evening" | null>(
    null,
  );

  useEffect(() => {
    // One frame after mount keeps SSR and first client render identical
    // (and satisfies lint's no-sync-setState rule).
    const raf = requestAnimationFrame(() => {
      setBucket(timeBucket(new Date().getHours()));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const name = isPending
    ? ""
    : displayName(session?.user?.name, session?.user?.email);
  const ready = bucket !== null;

  return (
    <div className="min-w-0 flex-1 text-center leading-tight transition-opacity duration-300">
      <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {/* Non-breaking space keeps the line's height before hydration. */}
        {ready ? `Good ${bucket}${name ? "," : "."}` : "\u00A0"}
      </p>
      <p
        className="font-display truncate text-lg font-semibold tracking-tight"
        style={{ opacity: ready && name ? 1 : 0 }}
        aria-hidden={!name}
      >
        {name || "\u00A0"}
      </p>
    </div>
  );
}
