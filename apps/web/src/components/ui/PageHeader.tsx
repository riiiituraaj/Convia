"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small stat / context chips rendered underneath the description. */
  meta?: React.ReactNode;
  className?: string;
}

/**
 * Standard header for every inner route (Missions, Commitments, Risks,
 * Agents, Memory, Integrations, Settings).
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  eyebrow,
  icon,
  actions,
  meta,
  className,
}) => (
  <header
    className={cn(
      "flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between",
      className
    )}
  >
    <div className="flex items-start gap-3.5">
      {icon ? (
        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-light bg-brand-pale text-brand">
          {icon}
        </span>
      ) : null}
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-accent">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary text-pretty">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-3.5 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
    </div>

    {actions ? (
      <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
    ) : null}
  </header>
);
