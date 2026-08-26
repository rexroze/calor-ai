"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "signin" | "signup";

/** Only allow same-app redirect targets: one leading slash, never "//". */
function safeNextPath(next: string | undefined): string | null {
  if (!next) return null;
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

/**
 * Shared brand card for sign-in and sign-up. `nextPath` arrives pre-validated
 * from the server page (it reads ?next= set by the auth proxy).
 */
export function AuthForm({
  mode,
  nextPath,
}: {
  mode: AuthMode;
  nextPath?: string | undefined;
}) {
  const router = useRouter();
  const isSignIn = mode === "signin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (password.length < 8) {
      toast.error("Passwords are at least 8 characters.");
      return;
    }

    setPending(true);
    try {
      const result = isSignIn
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            password,
            // better-auth requires a display name; the email handle is a
            // friendly default until profiles exist.
            name: email.split("@")[0]?.slice(0, 64) || "Friend",
          });

      if (result.error) {
        toast.error(
          result.error.status === 401
            ? "That email and password don't match."
            : result.error.message || "Something went wrong. Please try again.",
        );
        setPending(false);
        return;
      }

      toast.success(isSignIn ? "Welcome back" : "Account created");
      router.replace(safeNextPath(nextPath) ?? "/");
      // Sync server-rendered session state behind the navigation.
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection.");
      setPending(false);
    }
  }

  return (
    <Card className="reveal w-full max-w-sm gap-6 rounded-3xl border bg-card py-8">
      <CardContent className="space-y-6 px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark size="lg" />
          <div className="space-y-1">
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {isSignIn ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isSignIn
                ? "Your day picks up right where you left it."
                : "Snap your first meal in under a minute."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={pending}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <div className="relative">
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignIn ? "current-password" : "new-password"}
                placeholder="At least 8 characters"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={pending}
                className="h-11 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={pending}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOffIcon className="size-4.5" aria-hidden="true" />
                ) : (
                  <EyeIcon className="size-4.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full text-base"
            disabled={pending}
          >
            {pending ? (
              <>
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                {isSignIn ? "Signing in…" : "Creating…"}
              </>
            ) : isSignIn ? (
              "Sign in"
            ) : (
              "Sign up"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignIn ? "New to calorAI? " : "Already have an account? "}
          <Link
            href={
              isSignIn
                ? linkWithNext("/signup", nextPath)
                : linkWithNext("/signin", nextPath)
            }
            className="font-medium text-terracotta underline-offset-4 hover:underline"
          >
            {isSignIn ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function linkWithNext(href: string, nextPath: string | undefined): string {
  const safe = safeNextPath(nextPath);
  return safe && safe !== "/" ? `${href}?next=${encodeURIComponent(safe)}` : href;
}
