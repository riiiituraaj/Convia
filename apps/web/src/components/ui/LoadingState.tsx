"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  label?: string;
  /** Number of skeleton rows. */
  rows?: number;
  className?: string;
}

/** Calm skeleton loader used while react-query is fetching. */
export const LoadingState: React.FC<LoadingStateProps> = ({
  label = "Loading",
  rows = 3,
  className,
}) => (
  <div className={cn("space-y-3", className)} role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={index}
        className="animate-pulse rounded-xl border border-line-subtle bg-surface-muted p-4"
      >
        <div className="h-3 w-1/3 rounded-full bg-line" />
        <div className="mt-3 h-2.5 w-2/3 rounded-full bg-line-subtle" />
        <div className="mt-2 h-2.5 w-1/2 rounded-full bg-line-subtle" />
      </div>
    ))}
  </div>
);

/** Inline spinner for buttons and compact surfaces. */
export const InlineLoader: React.FC<{ className?: string; label?: string }> = ({
  className,
  label = "Working",
}) => (
  <span className={cn("inline-flex items-center gap-2 text-[13px] text-ink-secondary", className)}>
    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-accent border-t-transparent" />
    {label}
  </span>
);
