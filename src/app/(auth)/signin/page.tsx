import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
};

/** The auth proxy appends ?next=<path> when bouncing unauthenticated users here. */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const next = typeof resolved.next === "string" ? resolved.next : undefined;

  return <AuthForm mode="signin" nextPath={next} />;
}
