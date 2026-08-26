"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HouseIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

function isActiveTab(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Persistent bottom tab bar. The center FAB opens capture from anywhere.
 * Fixed to the viewport but clamped to the phone-width column on desktop.
 */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md"
    >
      <div className="relative border-t border-border/70 bg-background/85 pb-safe backdrop-blur-xl">
        <ul role="list" className="grid h-16 grid-cols-3 items-stretch">
          <li className="flex">
            <TabLink
              href="/"
              label="Today"
              active={isActiveTab(pathname, "/")}
              Icon={HouseIcon}
            />
          </li>

          <li className="relative flex justify-center">
            <Link
              href="/capture"
              aria-label="Log a meal"
              className={cn(
                "absolute -top-[26px] flex size-14 items-center justify-center rounded-full",
                "bg-primary text-primary-foreground shadow-lg shadow-primary/35",
                "ring-4 ring-background transition-transform duration-150 ease-out",
                "hover:brightness-[1.03] active:scale-90",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "[&_svg]:size-7",
              )}
            >
              <PlusIcon strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </li>

          <li className="flex">
            <TabLink
              href="/settings"
              label="Settings"
              active={isActiveTab(pathname, "/settings")}
              Icon={Settings2Icon}
            />
          </li>
        </ul>
      </div>
    </nav>
  );
}

function TabLink({
  href,
  label,
  active,
  Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  Icon: typeof HouseIcon;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-2 pt-2 pb-1.5",
        "transition-colors duration-150 active:scale-[0.96]",
        active
          ? "text-terracotta [&_svg]:stroke-[2.2]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-6" aria-hidden="true" />
      <span className={cn("text-[11px] leading-none", active && "font-semibold")}>
        {label}
      </span>
    </Link>
  );
}
