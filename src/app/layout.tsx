import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/register-sw";
import "./globals.css";

/* Body/UI voice: humanist, warm, proven at small sizes in health apps. */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

/* Display voice: distinctive grotesk for wordmark moments and big numerals.
   Tabular figures keep counters rock-steady (see .tnum in globals.css). */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Theme + preference bootstrap — must run before first paint so the chosen
 * appearance (localStorage "calorai-theme": "dark" | "light" | "system")
 * lands without a flash. Dark is the default state of :root; `.light` on
 * <html> flips it, so we only ever ADD the light class when the resolved
 * theme is light.
 *
 * User preferences piggyback on the same script (each guarded separately):
 *   - localStorage "calorai-units": "metric" | "imperial"  -> data-units
 *   - localStorage "calorai-gentle": "1" | "0"             -> data-gentle
 * Absence of the attribute means the default (metric / gentle off), so we
 * only ever SET attributes for non-default choices. Read back by the hooks
 * in components/shared/preferences.tsx.
 */
const THEME_INIT = `(function(){try{var t=localStorage.getItem("calorai-theme");var dark=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(!dark){document.documentElement.classList.add("light")}}catch(e){}try{var u=localStorage.getItem("calorai-units");if(u==="imperial"){document.documentElement.dataset.units=u}}catch(e){}try{var g=localStorage.getItem("calorai-gentle");if(g==="1"){document.documentElement.dataset.gentle=g}}catch(e){}})();`;

export const metadata: Metadata = {
  applicationName: "calorAI",
  title: {
    default: "calorAI",
    template: "%s · calorAI",
  },
  description:
    "Snap a photo of your food. calorAI estimates the calories and macros and keeps your day on track.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "calorAI",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /* The keyboard pushes content up instead of covering the capture form. */
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#17130f" },
    { media: "(prefers-color-scheme: light)", color: "#fbf7ef" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${bricolage.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <ServiceWorkerRegister />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
