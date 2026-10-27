"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  Brain,
  CalendarDays,
  ChevronDown,
  CircleCheckBig,
  Files,
  Gavel,
  LayoutDashboard,
  Library,
  MessagesSquare,
  Plane,
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
import { IconButton } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  { name: "Home", href: "/life", icon: LayoutDashboard },
  { name: "Ask CONVIA", href: "/conversations", icon: MessagesSquare },
  { name: "Documents", href: "/documents", icon: Files },
  { name: "Research", href: "/search", icon: Search },
  { name: "Projects", href: "/missions", icon: Target },
  { name: "Travel", href: "/travel", icon: Plane },
  { name: "Knowledge", href: "/memory", icon: Brain },
  { name: "Create", href: "/studio", icon: Sparkles },
  { name: "Schedule", href: "/life#resolve-day", icon: CalendarDays },
  { name: "Commitments", href: "/commitments", icon: CircleCheckBig },
  { name: "People", href: "/people", icon: Users },
  { name: "Waiting on", href: "/waiting", icon: Users },
  { name: "Decisions", href: "/decisions", icon: Gavel },
  { name: "Risks", href: "/risks", icon: ShieldAlert },
  { name: "Agent Center", href: "/agents", icon: Bot },
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Library", href: "/library", icon: Library },
  { name: "Integrations", href: "/integrations", icon: Plug },
];

const PRIMARY_ITEMS = NAV_ITEMS.slice(0, 9);
const MORE_ITEMS = NAV_ITEMS.slice(9);

export function isActivePath(pathname: string, href: string): boolean {
  if (href.startsWith("/life#")) return false;
  if (href === "/life") return pathname === "/life";
  if (href === "/commitments") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface SidebarProps {
  variant?: "desktop" | "drawer";
  open?: boolean;
  onClose?: () => void;
  userName?: string;
  userEmail?: string;
  onSeedDemo?: () => void;
  seeding?: boolean;
}

const SidebarContent: React.FC<Omit<SidebarProps, "variant" | "open">> = ({ onClose, userName, userEmail }) => {
  const pathname = usePathname();
  const hasMoreActive = MORE_ITEMS.some((item) => isActivePath(pathname, item.href)) || pathname === "/integrations";

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActivePath(pathname, item.href);
    return (
      <li key={`${item.name}-${item.href}`}>
        <Link
          href={item.href}
          onClick={onClose}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex min-h-10 items-center gap-3 rounded-[11px] px-3 text-[14px] font-medium transition-colors duration-150",
            active ? "bg-brand-pale text-brand-deep shadow-[0_2px_8px_rgba(24,43,69,0.08)]" : "text-ink-secondary hover:bg-surface-muted hover:text-ink"
          )}
        >
          <Icon className={cn("h-[17px] w-[17px] shrink-0", active ? "text-brand-mid" : "text-ink-muted group-hover:text-ink-secondary")} strokeWidth={1.8} />
          <span className="truncate">{item.name}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col rounded-[20px] bg-surface">
      <div className="flex items-center justify-between px-4 pb-4 pt-5">
        <Link href="/life" aria-label="CONVIA home" onClick={onClose} className="flex flex-col gap-1.5">
          <Logo height={26} />
          <span className="text-[11.5px] font-medium tracking-[0.01em] text-ink-muted">Your continuity workspace</span>
        </Link>
        {onClose ? <IconButton label="Close navigation" onClick={onClose} className="h-11 w-11 lg:hidden"><X className="h-4 w-4" strokeWidth={1.9} /></IconButton> : null}
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2.5 pb-3">
        <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Workspace</p>
        <ul className="space-y-0.5">{PRIMARY_ITEMS.map(renderItem)}</ul>
        <details className="group mt-1" open={hasMoreActive ? true : undefined}>
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-[11px] px-3 text-[14px] font-medium text-ink-secondary transition hover:bg-surface-muted hover:text-ink focus-visible:outline-offset-0 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3"><span className="flex h-[17px] w-[17px] items-center justify-center text-ink-muted"><Sparkles className="h-4 w-4" strokeWidth={1.8} /></span>More</span>
            <ChevronDown className="h-3.5 w-3.5 text-ink-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-0.5 space-y-0.5 pl-2">{MORE_ITEMS.map(renderItem)}</ul>
        </details>
      </nav>

      <div className="space-y-3 border-t border-line-subtle px-3 py-3">
        <Link href="/conversations" onClick={onClose} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-muted px-3 py-2.5 transition hover:bg-surface">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8eef8] text-brand-mid"><MessagesSquare className="h-4 w-4" strokeWidth={1.8} /></span>
          <span><span className="block text-[12.5px] font-semibold text-ink">Ask CONVIA</span><span className="block text-[11.5px] text-ink-muted">Continue a conversation</span></span>
        </Link>

        <Link href="/settings" onClick={onClose} className="flex items-center gap-2.5 rounded-[11px] px-1.5 py-1.5 transition hover:bg-surface-muted">
          <Avatar name={userName} size="sm" />
          <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium text-ink">{userName ?? "Your account"}</span><span className="block truncate text-[11.5px] text-ink-muted">{userEmail ?? "Account settings"}</span></span>
        </Link>
        <div className="flex items-center justify-between px-1.5">
          <span className="text-[11.5px] text-ink-muted">Appearance</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
};

const DrawerSidebar: React.FC<SidebarProps> = (props) => {
  const drawerRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;

  useEffect(() => {
    if (!props.open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) {
        event.preventDefault();
        drawerRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !drawerRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !drawerRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    drawerRef.current?.querySelector<HTMLElement>('button[aria-label="Close navigation"]')?.focus();
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [props.open]);

  return <>
    {props.open ? <button type="button" tabIndex={-1} aria-label="Close navigation" className="fixed inset-0 z-40 bg-[#172b45]/45 lg:hidden" onClick={props.onClose} /> : null}
    <aside ref={drawerRef} role="dialog" aria-modal={props.open ? "true" : undefined} aria-label="Navigation" aria-hidden={!props.open} inert={!props.open} tabIndex={-1} className={cn("fixed inset-y-0 left-0 z-50 w-[288px] p-2 transition-transform duration-200 ease-out lg:hidden", props.open ? "visible translate-x-0" : "invisible -translate-x-full")}>
      <div className="glass-panel h-full overflow-hidden rounded-[22px] shadow-pop"><SidebarContent {...props} /></div>
    </aside>
  </>;
};

export const Sidebar: React.FC<SidebarProps> = (props) => {
  if (props.variant === "drawer") return <DrawerSidebar {...props} />;

  return <aside aria-label="Navigation" className="glass-panel fixed inset-y-3 left-3 z-30 hidden w-[204px] overflow-hidden rounded-[21px] lg:block"><SidebarContent {...props} /></aside>;
};
