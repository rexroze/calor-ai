import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * PWA lane: keep the service worker uncacheable so updates are picked up
   * promptly (per the Next.js PWA guide). The SW itself is a hand-written
   * public/sw.js — Next 16's Turbopack build ignores webpack hooks, so
   * @serwist/next's build-time injection is not used.
   */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
