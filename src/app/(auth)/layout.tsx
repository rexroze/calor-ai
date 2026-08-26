import type { ReactNode } from "react";

/**
 * Centered stage for sign-in / sign-up: warm backdrop wash, brand card
 * floating in the middle of the viewport.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 pt-safe pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="app-backdrop" aria-hidden="true" />
      {children}
    </div>
  );
}
