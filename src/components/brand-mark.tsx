import { cn } from "@/lib/utils";

/**
 * calorAI mark plus a warm display-face wordmark.
 *
 * The mark is the full app-icon artwork (coral gradient tile, white "C",
 * droplet in the counter) reused verbatim from public/icons/icon.svg so the
 * login logo is pixel-faithful to the installed PWA icon.
 *
 * Gradient ids are static ("bm-bg"): `useId` isn't available in Server
 * Components and a module counter could drift between SSR and client
 * hydration. Duplicate ids across instances are technically invalid HTML but
 * harmless here — every definition is identical, so url(#bm-bg) always paints
 * the same gradient.
 */
export function BrandMark({
  size = "md",
  orientation = "horizontal",
  className,
}: {
  size?: "md" | "lg";
  /** horizontal: mark beside wordmark; stacked: mark centered above wordmark. */
  orientation?: "horizontal" | "stacked";
  className?: string;
}) {
  const mark = size === "lg" ? "size-14" : "size-10";
  const text = size === "lg" ? "text-3xl" : "text-2xl";

  const icon = (
    <svg
      viewBox="0 0 512 512"
      aria-hidden="true"
      className={cn(mark, "shrink-0")}
      fill="none"
    >
      <defs>
        <linearGradient id="bm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF8A5F" />
          <stop offset="1" stopColor="#F04E23" />
        </linearGradient>
      </defs>
      {/* Coral tile */}
      <rect width="512" height="512" rx={115} fill="url(#bm-bg)" />
      {/* The C: mid-radius 118 ring, 58 wide, opening ±39° at 3 o'clock */}
      <path
        d="M347.7 181.74 A118 118 0 1 0 347.7 330.26"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={58}
        strokeLinecap="butt"
      />
      {/* The droplet: tip up, round base, floating centered in the C's counter */}
      <path
        d="M256 192 C245 213 218 247 218 280 A38 38 0 0 0 294 280 C294 247 267 213 256 192 Z"
        fill="#FFFFFF"
      />
    </svg>
  );

  const wordmark = (
    <span className={cn("font-display font-semibold tracking-tight", text)}>
      calor<span className="text-terracotta">AI</span>
    </span>
  );

  if (orientation === "stacked") {
    return (
      <span className={cn("inline-flex flex-col items-center gap-3", className)}>
        {icon}
        {wordmark}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {icon}
      {wordmark}
    </span>
  );
}
