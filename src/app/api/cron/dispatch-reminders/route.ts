/**
 * POST /api/cron/dispatch-reminders — sends meal-log reminder push notifications.
 *
 * Called by an external scheduler (Upstash QStash) on a cron schedule.
 * Verifies the QStash signature before processing.
 *
 * Logic:
 *  1. Verify QStash request signature.
 *  2. Query all push_subscriptions where remindersEnabled = true.
 *  3. For each subscription, derive the subscriber's current local hour.
 *  4. Match against their configured meal-time windows.
 *  5. Dedupe: skip if lastSentKey matches today's date+meal.
 *  6. Send push, update lastSentKey.
 *  7. Delete rows on 404/410 (stale subscriptions).
 *
 * Payload is kept under 4 KB: { title, body, url }.
 * TTL 3600s is set in the send helper.
 */

import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { sendPushNotification } from "@/lib/push/send";

/* ---------------------------------------------------------------------------
 * QStash signature verification
 * ------------------------------------------------------------------------ */

/**
 * Minimal HMAC-SHA256 verification of QStash request signatures.
 *
 * QStash signs requests with:
 *   Authorization: Bearer <QSTASH_TOKEN>
 *   Upstash-Signature: <base64-encoded HMAC>
 *
 * We verify using QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY
 * env vars (provided by Upstash console).
 */
async function verifyQStashSignature(request: NextRequest): Promise<boolean> {
  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  const body = await request.text();
  const signingKeys = [
    process.env.QSTASH_CURRENT_SIGNING_KEY,
    process.env.QSTASH_NEXT_SIGNING_KEY,
  ].filter(Boolean) as string[];

  if (signingKeys.length === 0) {
    // No signing keys configured — reject (never silently trust).
    return false;
  }

  const encoder = new TextEncoder();

  for (const key of signingKeys) {
    const keyData = encoder.encode(key);
    const bodyData = encoder.encode(body);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBytes = Uint8Array.from(atob(signature), (c) =>
      c.charCodeAt(0),
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      signatureBytes,
      bodyData,
    );

    if (valid) return true;
  }

  return false;
}

/* ---------------------------------------------------------------------------
 * Meal-time window matching
 * ------------------------------------------------------------------------ */

/**
 * Default meal windows (start hour inclusive, end hour exclusive) in the
 * subscriber's local time. Users can override these via localStorage on
 * the client — the server uses defaults when no per-user config exists.
 */
const DEFAULT_WINDOWS: Record<string, [number, number]> = {
  breakfast: [7, 9],
  lunch: [12, 14],
  dinner: [18, 20],
};

/**
 * Determine which meal(s) the local hour falls into.
 * Returns an array because edge cases exist (e.g. hour 9 is end of
 * breakfast window and potentially start of a custom window).
 */
function currentMeals(localHour: number): string[] {
  const meals: string[] = [];
  for (const [meal, [start, end]] of Object.entries(DEFAULT_WINDOWS)) {
    if (localHour >= start && localHour < end) {
      meals.push(meal);
    }
  }
  return meals;
}

function getLocalHour(timezone: string): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hourPart = parts.find((p) => p.type === "hour");
  return hourPart ? parseInt(hourPart.value, 10) : 0;
}

function todayKey(meal: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD UTC
  return `${dateStr}:${meal}`;
}

/* ---------------------------------------------------------------------------
 * Route handler
 * ------------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  // --- 1. Verify QStash signature ---
  const bodyText = await request.text();
  const valid = await verifyQStashSignature(
    new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: bodyText,
    }) as NextRequest,
  );
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // --- 2. Fetch all enabled subscriptions ---
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.remindersEnabled, true));

  let sent = 0;

  // --- 3. Process each subscription ---
  for (const sub of subs) {
    const localHour = getLocalHour(sub.tz);
    const meals = currentMeals(localHour);

    if (meals.length === 0) continue;

    for (const meal of meals) {
      const key = todayKey(meal);

      // --- 5. Deduplication ---
      if (sub.lastSentKey === key) continue;

      // --- 4 & 6. Send push ---
      const payload = {
        title: `Time to log your ${meal}!`,
        body: `Don't forget to snap your plate and track your ${meal}.`,
        url: "/",
      };

      const ok = await sendPushNotification(
        {
          id: sub.id,
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        payload,
      );

      if (ok) {
        sent++;
        // Update lastSentKey for dedup
        await db
          .update(pushSubscriptions)
          .set({ lastSentKey: key })
          .where(eq(pushSubscriptions.id, sub.id));
      }
      // If ok === false, the subscription was 404/410 and already deleted
      // by sendPushNotification.
    }
  }

  return NextResponse.json({ sent });
}
