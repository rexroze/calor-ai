import { handler } from "@/lib/auth";

// Better Auth catch-all: handles /api/auth/* (sign-in/up/out, get-session,
// OAuth callbacks, ...). GET + POST cover all endpoints it exposes.
export const GET = handler;
export const POST = handler;
