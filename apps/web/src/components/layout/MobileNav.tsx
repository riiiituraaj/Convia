"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, CircleCheckBig, LayoutDashboard, Menu, Mic, MoreHorizontal, Play, ShieldAlert, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActivePath } from "./Sidebar";
import { IconButton } from "@/components/ui/Button";

const PRIMARY = [
  { name: "Dashboard", href: "/life", icon: LayoutDashboard },
  { name: "Missions", href: "/missions", icon: Target },
  { name: "Commitments", href: "/commitments", icon: CircleCheckBig },
  { name: "Risks", href: "/risks", icon: ShieldAlert },
  { name: "Agents", href: "/agents", icon: Bot },
];

export interface MobileNavProps {
  onOpenMenu: () => void;
  onOpenVoice: () => void;
  onSeedDemo: () => void;
}

/** Bottom navigation for mobile: quick destinations, drawer for everything else. */
export const MobileNav: React.FC<MobileNavProps> = ({ onOpenMenu, onOpenVoice, onSeedDemo }) => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface lg:hidden"
    >
      <ul className="flex items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {PRIMARY.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[11.5px] font-medium transition-colors duration-150 ease-out",
                  active ? "text-brand-deep" : "text-ink-muted"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors",
                    active ? "bg-brand-light" : "bg-transparent"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                {item.name}
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex w-full flex-col items-center gap-1 px-1 py-2.5 text-[11.5px] font-medium text-ink-muted"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px]">
              <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            More
          </button>
        </li>
      </ul>

      {/* Secondary actions stay reachable without crowding the bar. */}
      <div className="flex items-center justify-between gap-2 border-t border-line-subtle px-3 py-2">
        <button
          type="button"
          onClick={onOpenVoice}
          className="inline-flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[12px] font-medium text-ink-secondary"
        >
          <Mic className="h-3.5 w-3.5 text-brand-accent" strokeWidth={1.9} />
          Talk to Convia
        </button>
        <button
          type="button"
          onClick={onSeedDemo}
          className="inline-flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[12px] font-medium text-ink-secondary"
        >
          <Play className="h-3.5 w-3.5 text-brand-accent" strokeWidth={1.9} />
          Flagship demo
        </button>
      </div>
    </nav>
  );
};
