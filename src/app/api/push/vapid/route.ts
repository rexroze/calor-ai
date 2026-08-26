/**
 * GET /api/push/vapid — returns the VAPID public key.
 *
 * Public endpoint (no auth required). The client fetches this before
 * calling pushManager.subscribe() so it doesn't need the private key.
 */

import { NextResponse } from "next/server";

import { getVapidPublicKey } from "@/lib/push/keys";

export async function GET() {
  try {
    const publicKey = getVapidPublicKey();
    return NextResponse.json({ publicKey });
  } catch {
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 500 },
    );
  }
}
