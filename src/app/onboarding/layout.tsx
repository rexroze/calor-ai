import type { ReactNode } from "react";

/**
 * Full-page stage for the post-signup wizard — same warm backdrop and
 * centering as the auth screens, deliberately outside the tabbed app shell.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 pt-safe pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="app-backdrop" aria-hidden="true" />
      {children}
    </div>
  );
}
