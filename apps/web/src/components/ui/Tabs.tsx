"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterTabsProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Pill filter row used on Commitments, Memory, Agents and Missions.
 * Horizontally scrollable on small screens so the page never overflows.
 */
export const FilterTabs: React.FC<FilterTabsProps> = ({
  options,
  value,
  onChange,
  className,
  ariaLabel = "Filters",
}) => (
  <div
    role="tablist"
    aria-label={ariaLabel}
    className={cn(
      "convia-scroll-x -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1",
      className
    )}
  >
    {options.map((option) => {
      const isActive = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ease-out",
            isActive
              ? "border-brand bg-brand text-white"
              : "border-line bg-surface text-ink-secondary hover:border-line-strong hover:bg-surface-sunken hover:text-ink"
          )}
        >
          <span>{option.label}</span>
          {option.count !== undefined ? (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] font-semibold",
                isActive ? "bg-white/20 text-white" : "bg-surface-sunken text-ink-muted"
              )}
            >
              {option.count}
            </span>
          ) : null}
        </button>
      );
    })}
  </div>
);
