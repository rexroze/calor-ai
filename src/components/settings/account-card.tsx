"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, LogOutIcon } from "lucide-react";
import { toast } from "sonner";

import { useSession, authClient } from "@/lib/auth-client";
import { describeActionError } from "@/components/shared/action-errors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const email = session?.user?.email ?? null;
  const initial = email ? email[0].toUpperCase() : "?";

  async function handleSignOut() {
    if (signingOut) return; // guard double-submit
    setSigningOut(true);
    try {
      await authClient.signOut();
      toast.success("Signed out");
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

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-destructive/10 px-3.5 text-sm font-medium text-destructive transition-colors duration-150 hover:bg-destructive/15 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
        >
          <LogOutIcon className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </CardContent>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!signingOut) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of calorAI?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll need to sign in again to see your meals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={signingOut}
              onClick={(event) => {
                // Keep the dialog up while the request is in flight so the
                // pending spinner stays visible; navigation closes it.
                event.preventDefault();
                void handleSignOut();
              }}
            >
              {signingOut ? (
                <>
                  <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                  Signing out…
                </>
              ) : (
                "Sign out"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
