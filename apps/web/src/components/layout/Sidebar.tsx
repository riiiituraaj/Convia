"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  Brain,
  CircleCheckBig,
  Gavel,
  LayoutDashboard,
  Plug,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses, IconButton } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/life", icon: LayoutDashboard },
  { name: "Missions", href: "/missions", icon: Target },
  { name: "Commitments", href: "/commitments", icon: CircleCheckBig },
  { name: "People", href: "/people", icon: Users },
  { name: "Waiting On", href: "/waiting", icon: Users },
  { name: "Decisions", href: "/decisions", icon: Gavel },
  { name: "Risks & Recovery", href: "/risks", icon: ShieldAlert },
  { name: "Agent Center", href: "/agents", icon: Bot },
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Memory", href: "/memory", icon: Brain },
  { name: "Search", href: "/search", icon: Search },
  { name: "Integrations", href: "/integrations", icon: Plug },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/life") return pathname === "/life";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface SidebarProps {
  /** `drawer` renders the mobile off-canvas variant. */
  variant?: "desktop" | "drawer";
  open?: boolean;
  onClose?: () => void;
  userName?: string;
  userEmail?: string;
  onSeedDemo?: () => void;
  seeding?: boolean;
}

const SidebarContent: React.FC<Omit<SidebarProps, "variant" | "open">> = ({
  onClose,
  userName,
  userEmail,
  onSeedDemo,
  seeding,
}) => {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between px-5 pb-5 pt-6">
        <Link href="/life" aria-label="CONVIA home" className="flex flex-col gap-1.5">
          <Logo height={26} />
          <span className="text-[11px] font-medium text-ink-muted">Never lose the thread.</span>
        </Link>
        {onClose ? (
          <IconButton label="Close navigation" onClick={onClose} className="lg:hidden">
            <X className="h-4 w-4" strokeWidth={1.9} />
          </IconButton>
        ) : null}
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Continuity engine
        </p>

        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-150 ease-out",
                    active
                      ? "bg-brand-light text-brand-deep"
                      : "text-ink-secondary hover:bg-surface-sunken hover:text-ink"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      active ? "text-brand-deep" : "text-ink-muted group-hover:text-ink-secondary"
                    )}
                    strokeWidth={1.75}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-line-subtle px-4 py-4">
        <div className="rounded-xl border border-brand-light bg-brand-pale p-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-accent" strokeWidth={1.9} />
            <p className="text-[12px] font-semibold text-brand-deep">Convia Intelligence</p>
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-secondary">
            Watching your commitments continuously.
          </p>
          {onSeedDemo ? (
            <button
              type="button"
              onClick={onSeedDemo}
              disabled={seeding}
              className={buttonClasses("secondary", "sm", "mt-3 w-full")}
            >
              {seeding ? "Orchestrating..." : "Load flagship demo"}
            </button>
          ) : null}
        </div>

        <Link
          href="/settings"
          onClick={onClose}
          className="flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors duration-150 ease-out hover:bg-surface-sunken"
        >
          <Avatar name={userName} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-medium text-ink">
              {userName ?? "Continuity user"}
            </span>
            <span className="block truncate text-[11px] text-ink-muted">
              {userEmail ?? "Account & settings"}
            </span>
          </span>
        </Link>

        {!userName ? (
          <Link
            href="/login"
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            Sign in
          </Link>
        ) : null}

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink-muted">Appearance</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = (props) => {
  if (props.variant === "drawer") {
    return (
      <>
        {props.open ? (
          <div
            className="fixed inset-0 z-40 bg-[rgba(11,47,36,0.4)] backdrop-blur-[2px] animate-fade-in lg:hidden"
            onClick={props.onClose}
            aria-hidden="true"
          />
        ) : null}
        <aside
          aria-label="Navigation"
          aria-hidden={!props.open}
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[276px] border-r border-line shadow-pop transition-transform duration-200 ease-out lg:hidden",
            props.open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent {...props} />
        </aside>
      </>
    );
  }

  return (
    <aside
      aria-label="Navigation"
      className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-line lg:block"
    >
      <SidebarContent {...props} />
    </aside>
  );
};
