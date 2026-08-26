"use client";

import { useCallback, useEffect, useState } from "react";
import { BellIcon, BellOffIcon, InfoIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/* ---------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------ */

const STORAGE_KEY = "calorai-reminder-times";

const DEFAULT_TIMES: MealTimes = {
  breakfast: "08:00",
  lunch: "12:30",
  dinner: "19:00",
};

type MealTimes = {
  breakfast: string;
  lunch: string;
  dinner: string;
};

type PermissionState = "supported" | "denied" | "not-supported";

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function loadTimes(): MealTimes {
  if (typeof window === "undefined") return DEFAULT_TIMES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_TIMES, ...JSON.parse(raw) };
  } catch {
    /* fall through */
  }
  return DEFAULT_TIMES;
}

function saveTimes(times: MealTimes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
  } catch {
    /* storage full or blocked — silent */
  }
}

function detectPermission(): PermissionState {
  if (typeof window === "undefined") return "not-supported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return "not-supported";
  return Notification.permission === "denied" ? "denied" : "supported";
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS PWA: window.navigator.standalone
  if ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone) return true;
  // Android / general: display-mode CSS media query
  return window.matchMedia("(display-mode: standalone)").matches;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------ */

export function RemindersCard() {
  const [permission] = useState<PermissionState>(() => detectPermission());
  const [enabled, setEnabled] = useState(false);
  const [times, setTimes] = useState<MealTimes>(() => loadTimes());
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Detect existing subscription on mount (async) ---
  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
            setSubscription(sub);
            setEnabled(true);
          }
        });
      });
    }
  }, []);

  // --- Time change handler ---
  const handleTimeChange = useCallback(
    (meal: keyof MealTimes, value: string) => {
      setTimes((prev) => {
        const next = { ...prev, [meal]: value };
        saveTimes(next);
        return next;
      });
    },
    [],
  );

  // --- Enable reminders ---
  const handleEnable = useCallback(async () => {
    // Gate: iOS requires home-screen install
    if (isIOSSafari() && !isStandalone()) {
      toast.info("Install calorAI to your Home Screen first", {
        description:
          "On iPhone/iPad, tap the Share button → 'Add to Home Screen', then come back to enable reminders.",
        duration: 8000,
      });
      return;
    }

    if (Notification.permission === "denied") {
      toast.error("Notifications are blocked", {
        description:
          "Please enable notifications in your browser/OS settings and try again.",
      });
      return;
    }

    setLoading(true);
    try {
      // Request permission if not yet granted
      if (Notification.permission !== "granted") {
        const result = await Notification.requestPermission();
        if (result !== "granted") {
          toast.error("Notification permission denied");
          return;
        }
      }

      // Fetch VAPID public key
      const res = await fetch("/api/push/vapid");
      if (!res.ok) throw new Error("Failed to fetch VAPID key");
      const { publicKey } = await res.json();

      // Subscribe to push
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Register with our server
      const subJson = sub.toJSON();
      const apiRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
          tz,
        }),
      });

      if (!apiRes.ok) throw new Error("Failed to register subscription");

      setSubscription(sub);
      setEnabled(true);
      toast.success("Reminders enabled!");
    } catch (error) {
      console.error("[RemindersCard] enable failed:", error);
      toast.error("Could not enable reminders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Disable reminders ---
  const handleDisable = useCallback(async () => {
    setLoading(true);
    try {
      // Unsubscribe from browser push
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove from server
      if (subscription) {
        const subJson = subscription.toJSON();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subJson.endpoint }),
        });
      }

      setSubscription(null);
      setEnabled(false);
      toast.success("Reminders disabled");
    } catch (error) {
      console.error("[RemindersCard] disable failed:", error);
      toast.error("Could not disable reminders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [subscription]);

  /* ----- Render ----- */

  const permissionLabel =
    permission === "denied"
      ? "Blocked by browser"
      : permission === "not-supported"
        ? "Not supported on this device"
        : enabled
          ? "Active"
          : "Off";

  return (
    <Card className="reveal gap-5 py-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg tracking-tight">
          {enabled ? (
            <BellIcon className="size-5 text-primary" aria-hidden="true" />
          ) : (
            <BellOffIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          )}
          Meal reminders
        </CardTitle>
        <CardDescription>
          Get a push notification when it&apos;s time to log a meal. Tap to
          open the app and snap your plate.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Toggle row */}
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-sm font-medium text-foreground">
              {enabled ? "Reminders on" : "Reminders off"}
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {permissionLabel}
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={loading || permission === "denied" || permission === "not-supported"}
            onCheckedChange={(checked) =>
              checked ? handleEnable() : handleDisable()
            }
            aria-label="Toggle meal reminders"
          />
        </div>

        {/* iOS guidance */}
        {isIOSSafari() && !isStandalone() && !enabled && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              On iPhone/iPad, reminders require the app to be installed to your
              Home Screen. Tap the <strong>Share</strong> button in Safari and
              select <strong>Add to Home Screen</strong>, then return here to
              enable reminders.
            </p>
          </div>
        )}

        {/* Meal time pickers */}
        {enabled && (
          <div className="space-y-3 border-t border-border/60 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Reminder times
            </h3>
            {(["breakfast", "lunch", "dinner"] as const).map((meal) => (
              <div
                key={meal}
                className="flex items-center justify-between gap-3"
              >
                <Label
                  htmlFor={`reminder-${meal}`}
                  className="min-w-[5.5rem] text-sm capitalize text-foreground"
                >
                  {meal}
                </Label>
                <Input
                  id={`reminder-${meal}`}
                  type="time"
                  value={times[meal]}
                  onChange={(e) => handleTimeChange(meal, e.target.value)}
                  className="h-9 w-28 bg-background text-right text-sm"
                />
              </div>
            ))}
            <p className="text-xs leading-relaxed text-muted-foreground">
              You&apos;ll get a reminder during the 2-hour window around each
              time. Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
