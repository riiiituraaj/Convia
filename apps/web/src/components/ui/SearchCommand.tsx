"use client";

import React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchCommandProps {
  onClick: () => void;
  placeholder?: string;
  /** `on-brand` renders the frosted variant used inside the hero gradient. */
  variant?: "surface" | "on-brand";
  className?: string;
}

/**
 * Premium command centre entry point. It behaves as a button that opens the
 * command palette, so it never fights the global keyboard shortcut.
 */
export const SearchCommand: React.FC<SearchCommandProps> = ({
  onClick,
  placeholder = "Search commitments, missions, or anything...",
  variant = "surface",
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Open command palette"
    className={cn(
      "group flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13px] transition-all duration-150 ease-out",
      variant === "surface"
        ? "border border-line-strong bg-surface text-ink-muted shadow-card hover:border-brand hover:bg-surface-muted"
        : "convia-on-brand-control text-white hover:text-white",
      className
    )}
  >
    <Search
      className={cn(
        "h-4 w-4 shrink-0 transition-colors",
        variant === "surface" ? "text-ink-muted group-hover:text-ink-secondary" : "text-white"
      )}
      strokeWidth={1.9}
    />
    <span className="flex-1 truncate">{placeholder}</span>
    <kbd
      className={cn(
        "hidden shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex",
        variant === "surface"
          ? "border-line bg-surface-sunken text-ink-muted"
          : "border-white/30 bg-white/10 text-white"
      )}
    >
      ⌘K
    </kbd>
  </button>
);
