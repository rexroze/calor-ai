import type { Metadata } from "next";

/**
 * Owned by the PWA lane. Offline fallback served by the service worker
 * (public/sw.js) when a navigation fails and nothing cached matches.
 * Kept dependency-free and static so it can be cached at SW install time.
 */
export const metadata: Metadata = {
  title: "Offline — calorAI",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#FFF7F0] px-6 text-center">
      <div
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-2xl bg-[#FF6B4A]"
      >
        <span className="text-3xl font-black text-white">c</span>
      </div>
      <h1 className="text-xl font-semibold text-[#3D1F14]">You&apos;re offline</h1>
      <p className="max-w-xs text-sm leading-relaxed text-[#8A6A5C]">
        calorAI needs a connection to sync your macros. Pages you&apos;ve already
        visited stay available, and everything picks back up automatically once
        you&apos;re reconnected.
      </p>
    </main>
  );
}
