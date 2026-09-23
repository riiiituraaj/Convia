"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds a subtle lift on hover — use for clickable cards only. */
  interactive?: boolean;
  /** Applies the standard card padding. */
  padded?: boolean;
}

/**
 * The single card primitive used across CONVIA.
 * White surface, hairline border, very soft elevation.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive = false, padded = false, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-line bg-surface shadow-card transition-[box-shadow,border-color,transform] duration-200 ease-out",
        interactive && "hover:-translate-y-px hover:border-line-strong hover:shadow-card-hover",
        padded && "p-5 sm:p-6",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Wraps the header in the standard bottom divider. */
  divided?: boolean;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  icon,
  action,
  className,
  divided = true,
}) => (
  <div
    className={cn(
      "flex items-start justify-between gap-4 px-5 py-4 sm:px-6",
      divided && "border-b border-line-subtle",
      className
    )}
  >
    <div className="flex min-w-0 items-start gap-3">
      {icon ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-pale text-brand">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-secondary">{subtitle}</p>
        ) : null}
      </div>
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div className={cn("px-5 py-4 sm:px-6", className)} {...rest}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div
    className={cn(
      "flex items-center justify-between gap-3 border-t border-line-subtle px-5 py-3.5 sm:px-6",
      className
    )}
    {...rest}
  >
    {children}
  </div>
);

export interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/** Page / section level heading used consistently on every route. */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  eyebrow,
  action,
  icon,
  className,
}) => (
  <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
    <div className="flex items-start gap-3">
      {icon ? (
        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-brand-light bg-brand-pale text-brand">
          {icon}
        </span>
      ) : null}
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-accent">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-ink sm:text-[24px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
    </div>
    {action ? <div className="flex items-center gap-2">{action}</div> : null}
  </div>
);
