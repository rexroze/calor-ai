"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FlameIcon } from "lucide-react";
import { toast } from "sonner";

import { usePrefersReducedMotion } from "@/components/shared/use-prefers-reduced-motion";

/**
 * Client-side controller for calorAI's two quiet celebration moments.
 *
 * Lives inside the hero section (which is `relative`), wrapping the ring so
 * the burst overlay can anchor to the ring's exact center. Renders nothing
 * until a moment triggers, overlays absolutely (zero layout shift), and is
 * skippable by nature: it never blocks interaction or reading.
 *
 * Both moments persist to localStorage so refreshes/re-renders never replay:
 *   - `calorai-celebrated:{dateISO}` — ring closed for that calendar day
 *   - `calorai-milestone:{value}`   — streak toast shown for that milestone
 *
 * All decisions happen inside effects against client-only state
 * (localStorage, matchMedia), so the SSR output is deterministic.
 */

const SPARK_COUNT = 12;

/** Let the entrance reveal settle and the ring finish drawing (~1.1s) first. */
const TRIGGER_DELAY_MS = 1150;
/** How long the arc glow — and therefore the burst overlay — stays mounted. */
const CELEBRATION_MS = 1600;

const STREAK_MILESTONES = [7, 14, 30] as const;

const STREAK_TOAST_COPY: Record<(typeof STREAK_MILESTONES)[number], string> = {
  7: "nice rhythm 🔥",
  14: "two weeks strong 🔥",
  30: "a full month, every day logged 🔥",
};

const celebratedKey = (dateISO: string) => `calorai-celebrated:${dateISO}`;
const milestoneKey = (value: number) => `calorai-milestone:${value}`;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage disabled/private mode: celebrations degrade to session-only.
  }
}

const RingCelebrationContext = createContext(false);

/**
 * True while the ring-close glow pulse is playing. CalorieRing consumes this
 * to attach the `.animate-ring-glow` class to its progress arc.
 */
export function useRingCelebration(): boolean {
  return useContext(RingCelebrationContext);
}

export function GoalCelebration({
  consumed,
  goal,
  dateISO,
  isToday,
  streak,
  children,
}: {
  /** Total kcal eaten for `dateISO` (from getDay). */
  consumed: number;
  /** Daily kcal goal (from getGoals). */
  goal: number;
  dateISO: string;
  /** Celebrations only play for today — reviewing past days stays quiet. */
  isToday: boolean;
  /** Current logging streak (from getStreak, fetched once by the page). */
  streak: number;
  children: ReactNode;
}) {
  // Drives both the burst overlay and (via context) the arc glow. Only ever
  // flipped inside effects, so the server render always matches the first
  // client render — no hydration mismatch.
  const [celebrating, setCelebrating] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const timersRef = useRef<number[]>([]);

  // Clear any pending celebration timers if we unmount mid-moment.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers) window.clearTimeout(id);
      timers.length = 0;
    };
  }, []);

  // --- Moment 1: ring close -------------------------------------------------
  // Trigger math: the day counts as closed when 0 < consumed <= goal (over
  // goal never celebrates; an empty day never celebrates). The first client
  // observation of a closed, not-yet-celebrated today is the below-goal →
  // within-goal crossing as far as the client can know it; claiming the
  // per-date flag at that instant makes it strictly once per calendar day.
  useEffect(() => {
    if (!isToday) return;

    const key = celebratedKey(dateISO);
    // Decide one tick out so React StrictMode's double effect invocation
    // collapses into a single decision (attempt #1 is cleaned up first).
    const decide = window.setTimeout(() => {
      const closed = consumed > 0 && goal > 0 && consumed <= goal;
      if (!closed || readStorage(key)) return;

      writeStorage(key, "1"); // claim the day immediately — refreshes never replay

      // Reduced motion: record that the moment happened, skip every visual.
      if (prefersReducedMotion) return;

      setCelebrating(true);
      timersRef.current.push(
        window.setTimeout(() => setCelebrating(false), CELEBRATION_MS),
      );
    }, TRIGGER_DELAY_MS);

    return () => window.clearTimeout(decide);
  }, [consumed, goal, dateISO, isToday, prefersReducedMotion]);

  // --- Moment 2: streak milestones -------------------------------------------
  // Informational, so it plays under reduced motion too. One sonner toast,
  // persisted per milestone so it never repeats. The synchronous localStorage
  // write doubles as the StrictMode double-toast guard.
  useEffect(() => {
    const milestone = STREAK_MILESTONES.find((value) => value === streak);
    if (!milestone || readStorage(milestoneKey(milestone))) return;
    writeStorage(milestoneKey(milestone), "1");

    toast(`${milestone}-day streak — ${STREAK_TOAST_COPY[milestone]}`, {
      icon: <FlameIcon className="size-4 text-primary" aria-hidden="true" />,
      duration: 5000,
    });
  }, [streak]);

  return (
    <div className="relative">
      {/* Burst layer precedes the ring in DOM order, so sparks rise from
          behind it. Absolutely positioned + pointer-events-none: no layout
          impact, nothing to intercept. Unmounts with `celebrating`. */}
      {celebrating && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="celebration-origin">
            {Array.from({ length: SPARK_COUNT }, (_, index) => (
              <span key={index} className="celebration-spark" />
            ))}
            <span className="celebration-halo" />
          </div>
        </div>
      )}

      <RingCelebrationContext.Provider value={celebrating}>
        {children}
      </RingCelebrationContext.Provider>
    </div>
  );
}
