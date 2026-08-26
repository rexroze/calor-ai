/**
 * POST /api/push/subscribe — register or update a push subscription.
 * DELETE /api/push/subscribe — remove a push subscription.
 *
 * Authenticated via Better Auth session cookie.
 */

import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint, p256dh, auth: subAuth, tz } = body as {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
    tz?: string;
  };

  if (!endpoint || !p256dh || !subAuth) {
    return NextResponse.json(
      { error: "Missing required fields: endpoint, p256dh, auth" },
      { status: 400 },
    );
  }

  // Upsert by endpoint: if the endpoint already exists for this user,
  // update the keys; if it exists for another user, that's fine too (one
  // browser = one endpoint = one subscription).
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);

  if (existing.length > 0) {
    // Update keys + tz + re-enable
    await db
      .update(pushSubscriptions)
      .set({
        userId: session.user.id,
        p256dh,
        auth: subAuth,
        tz: tz ?? existing[0].tz,
        remindersEnabled: true,
      })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  } else {
    await db.insert(pushSubscriptions).values({
      userId: session.user.id,
      endpoint,
      p256dh,
      auth: subAuth,
      tz: tz ?? "UTC",
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint } = body as { endpoint?: string };

  if (!endpoint) {
    return NextResponse.json(
      { error: "Missing required field: endpoint" },
      { status: 400 },
    );
  }

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.userId, session.user.id),
      ),
    );

  return NextResponse.json({ ok: true });
}
