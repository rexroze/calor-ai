import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * analyzePhoto ships the full JPEG as base64 in a server-action argument;
   * the 1MB default body limit silently rejects detailed photos (~1.4MB once
   * base64-encoded). 2mb covers the raw pipeline output (see Next.js docs:
   * experimental > serverActions > bodySizeLimit).
   */
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  /**
   * PWA lane: keep the service worker uncacheable so updates are picked up
   * promptly (per the Next.js PWA guide). The SW itself is a hand-written
   * public/sw.js — Next 16's Turbopack build ignores webpack hooks, so
   * @serwist/next's build-time injection is not used.
   */
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
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
