import type { ReactNode } from "react";

import { BottomTabBar } from "@/components/bottom-tab-bar";

/**
 * Shell for the tabbed part of the app (Today, Settings). Pages own their
 * sticky TopBar and main container; this layer adds the warm desktop backdrop
 * and the persistent bottom tabs with the center capture FAB.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div className="app-backdrop" aria-hidden="true" />
      {children}
      <BottomTabBar />
    </div>
  );
}
