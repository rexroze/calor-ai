import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = {
  title: "Set up your targets",
};

/**
 * Server-side session guard: unauthenticated visits bounce to sign-in.
 * Signed-in users may enter (or re-enter) freely — onboarding is also the
 * "recalculate targets" surface reachable from settings later.
 */
export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/signin");
  }

  return <OnboardingWizard displayName={session.user.name ?? ""} />;
}
