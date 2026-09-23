"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "warning";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white shadow-[0_1px_2px_rgba(11,47,36,0.18)] hover:bg-brand-deep",
  secondary:
    "bg-brand-pale text-brand border border-brand-light hover:bg-brand-light",
  outline: "bg-surface text-ink border border-line hover:bg-surface-sunken hover:border-line-strong",
  ghost: "bg-transparent text-ink-secondary hover:bg-surface-sunken hover:text-ink",
  danger: "bg-danger text-white hover:brightness-95",
  warning: "bg-warning-light text-[#8A5A00] border border-[#F7E2B8] hover:bg-[#FDEBCB]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner and blocks interaction. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading ? <ButtonSpinner /> : null}
      {children}
    </button>
  );
});

export const ButtonSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <span
    aria-hidden="true"
    className={cn(
      "h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70",
      className
    )}
  />
);

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required for accessibility — icon-only controls always need a label. */
  label: string;
  variant?: "ghost" | "outline" | "secondary";
  size?: "sm" | "md";
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  variant = "ghost",
  size = "md",
  className,
  children,
  ...rest
}) => (
  <button
    aria-label={label}
    title={label}
    className={cn(
      "inline-flex shrink-0 items-center justify-center rounded-[10px] transition-colors duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
      size === "sm" ? "h-8 w-8" : "h-9 w-9",
      variant === "ghost" && "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
      variant === "outline" && "border border-line bg-surface text-ink-secondary hover:bg-surface-sunken",
      variant === "secondary" && "border border-brand-light bg-brand-pale text-brand hover:bg-brand-light",
      className
    )}
    {...rest}
  >
    {children}
  </button>
);
