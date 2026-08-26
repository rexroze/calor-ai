import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky per-page top area. Pages drop their own content in (date navigator,
 * title + back, etc.). Safe-area padding keeps it below notches on iOS.
 */
export function TopBar({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("sticky top-0 z-30 pt-safe", className)}>
      <div className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 w-full max-w-md items-center px-4 py-2">
          {children}
        </div>
      </div>
    </header>
  );
}
