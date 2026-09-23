"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Shows the CONVIA mark above the message (used for onboarding states). */
  branded?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  branded = false,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-muted px-6 py-12 text-center",
      className
    )}
  >
    {branded ? (
      <Logo variant="dark" className="mb-5 h-7 opacity-80" />
    ) : Icon ? (
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink-muted">
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </span>
    ) : null}

    <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
    {description ? (
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-secondary">
        {description}
      </p>
    ) : null}
    {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
  </div>
);
