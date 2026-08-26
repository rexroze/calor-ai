"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { toast } from "sonner";

import { useSession, authClient } from "@/lib/auth-client";
import { describeActionError } from "@/components/shared/action-errors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Signed-in identity + sign out. Reads the session reactively via better-auth. */
export function AccountCard() {
  const router = useRouter();
  const { data: session, isPending, error } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  const email = session?.user?.email ?? null;
  const initial = email ? email[0].toUpperCase() : "?";

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/signin");
      router.refresh();
    } catch {
      toast.error(describeActionError(new Error("UNAUTHORIZED")));
      setSigningOut(false);
    }
  }

  return (
    <Card className="reveal gap-5 py-6" style={{ animationDelay: "60ms" }}>
      <CardHeader>
        <CardTitle className="font-display text-lg tracking-tight">
          Account
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-3" aria-live="polite">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 font-display text-lg font-semibold text-primary"
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            {isPending ? (
              <>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-1.5 h-3 w-24" />
              </>
            ) : error || !email ? (
              <p className="text-sm leading-snug text-muted-foreground">
                Signed in on this device
              </p>
            ) : (
              <>
                <p className="truncate text-sm font-medium">{email}</p>
                <p className="text-xs text-muted-foreground">Signed in</p>
              </>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-10 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleSignOut}
          disabled={signingOut || isPending}
        >
          <LogOutIcon aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </CardContent>
    </Card>
  );
}
