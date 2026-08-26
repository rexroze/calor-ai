import type { MetadataRoute } from "next";

/**
 * Owned by the PWA lane. Served at /manifest.webmanifest and auto-linked
 * into every page's <head> by the App Router.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "calorAI — Macro Tracker",
    short_name: "calorAI",
    description:
      "Track calories and macros with AI-powered food logging — snap a photo, get instant macros.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF7F0",
    theme_color: "#FF6B4A",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        // Hint for tooling that consumes the manifest; iOS itself reads the
        // apple-touch-icon <link> tag (owned by the UI lane's layout.tsx).
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
