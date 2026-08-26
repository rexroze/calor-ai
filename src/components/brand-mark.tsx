import { cn } from "@/lib/utils";

/**
 * calorAI wordmark: a flame-drop mark plus a warm display-face wordmark.
 * Used on auth screens, offline fallback and not-found — anywhere the app
 * shell is absent.
 */
export function BrandMark({
  size = "md",
  className,
}: {
  size?: "md" | "lg";
  className?: string;
}) {
  const mark = size === "lg" ? "size-14" : "size-10";
  const text = size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className={cn(mark, "shrink-0")}
        fill="none"
      >
        {/* Flame-drop: one confident shape, no gradients needed. */}
        <path
          d="M24 4C24 4 38 17.5 38 29a14 14 0 1 1-28 0C10 17.5 24 4 24 4Z"
          className="fill-primary"
        />
        <path
          d="M24 22c2.6 3.1 5.5 6.4 5.5 9.8a5.5 5.5 0 1 1-11 0c0-3.4 2.9-6.7 5.5-9.8Z"
          className="fill-background/70"
        />
      </svg>
      <span
        className={cn(
          "font-display font-semibold tracking-tight",
          text,
        )}
      >
        calor<span className="text-terracotta">AI</span>
      </span>
    </span>
  );
}
