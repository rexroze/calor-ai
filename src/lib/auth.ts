import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh every 24h
  },
  socialProviders: {
    // Google OAuth is only wired when both env vars are present.
    ...(googleConfigured && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    }),
  },
  trustedOrigins: process.env.NEXT_PUBLIC_APP_URL
    ? [process.env.NEXT_PUBLIC_APP_URL]
    : undefined,
});

/** Raw fetch-style handler — wire this to your catch-all API route. */
export const handler = auth.handler;

/**
 * Server-side email/password sign-in helper (sets session cookies on the
 * passed `headers`). Prefer `authClient.signIn.email` from the browser.
 */
export async function signIn(email: string, password: string) {
  return auth.api.signInEmail({ body: { email, password } });
}

/** Server-side sign-out helper. */
export async function signOut(headers?: Headers) {
  return auth.api.signOut(headers ? { headers } : undefined);
}
