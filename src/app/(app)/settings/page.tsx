import type { Metadata } from "next";

import { getGoals } from "@/app/actions/goals";
import { TopBar } from "@/components/top-bar";
import { AccountCard } from "@/components/settings/account-card";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { GoalsForm } from "@/components/settings/goals-form";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const goals = await getGoals();

  return (
    <>
      <TopBar>
        <h1 className="flex-1 font-display text-lg font-semibold tracking-tight">
          Settings
        </h1>
      </TopBar>

      <main className="mx-auto w-full max-w-md space-y-4 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
        <AppearanceCard />
        <GoalsForm initialGoals={goals} />
        <AccountCard />

        <p className="reveal pt-3 text-center text-xs text-muted-foreground" style={{ animationDelay: "160ms" }}>
          calorAI — snap a plate, see the day.
        </p>
      </main>
    </>
  );
}
