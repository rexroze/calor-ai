import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Route protection (Next.js 16: `middleware.ts` was renamed to `proxy.ts`).
 *
 * - Unauthenticated users hitting protected pages -> /signin
 * - Authenticated users hitting /signin or /signup -> /
 *
 * The matcher excludes API routes (Better Auth handles its own), Next
 * internals and common static assets. Server actions re-verify the session
 * server-side regardless — proxy coverage alone is never trusted.
 */

const PROTECTED_PREFIXES = ["/meal", "/capture", "/settings"];
const AUTH_PAGES = new Set(["/signin", "/signup"]);

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Full session validation against the DB (Node.js runtime is the default
  // for proxy in Next 16, so importing better-auth here is fine).
  const session = await auth.api.getSession({ headers: request.headers });

  if (AUTH_PAGES.has(pathname)) {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!session && isProtectedPath(pathname)) {
    const signInUrl = new URL("/signin", request.url);
    // Remember where the user wanted to go so the sign-in page can send
    // them back after authenticating.
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api routes (incl. /api/auth/*)
     * - _next/static, _next/image
     * - favicon.ico, metadata files, service worker, manifest
     * - common image/font assets
     */
    "/((?!api|_next/static|_next/image|sw\\.js|sitemap\\.xml|robots\\.txt|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)",
  ],
};
