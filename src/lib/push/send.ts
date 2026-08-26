/**
 * Web-push sender with automatic stale-subscription cleanup.
 *
 * When a push fails with HTTP 404 or 410 the corresponding
 * `push_subscriptions` row is deleted — these subscription IDs can never be
 * reused.
 *
 * TTL is set to 3600 s (1 hour) which is appropriate for meal reminders:
 * long enough for the device to come back online, short enough that stale
 * notifications aren't delivered hours late.
 */

import { eq } from "drizzle-orm";
import webPush from "web-push";

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getVapidDetails } from "./keys";

/* ---------------------------------------------------------------------------
 * Module-scope VAPID setup — safe because this file is only imported in
 * Node.js (API routes, server actions, cron handlers).
 * ------------------------------------------------------------------------ */

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const details = getVapidDetails();
  webPush.setVapidDetails(details.subject, details.publicKey, details.privateKey);
  vapidConfigured = true;
}

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------ */

export interface PushPayload {
  title: string;
  body: string;
  /** URL to open when the notification is tapped. */
  url?: string;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/* ---------------------------------------------------------------------------
 * Send
 * ------------------------------------------------------------------------ */

const TTL_SECONDS = 3600;
const UA_WEB_PUSH = "calorai-push";

/**
 * Send a single push notification.
 *
 * Returns `true` on success, `false` if the subscription was stale and has
 * been pruned. Propagates all other errors to the caller.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionRow,
  payload: PushPayload,
): Promise<boolean> {
  ensureVapid();

  const pushSubscription: webPush.PushSubscription = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };

  try {
    await webPush.sendNotification(pushSubscription, JSON.stringify(payload), {
      TTL: TTL_SECONDS,
      urgency: "normal",
      headers: { "User-Agent": UA_WEB_PUSH },
    });
    return true;
  } catch (error: unknown) {
    // web-push wraps HTTP errors as WebPushError with a `statusCode` property.
    const status =
      typeof error === "object" && error !== null && "statusCode" in error
        ? (error as { statusCode: number }).statusCode
        : undefined;

    if (status === 404 || status === 410) {
      // Subscription expired or was unsubscribed — remove it.
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, subscription.id));
      return false;
    }

    throw error;
  }
}
