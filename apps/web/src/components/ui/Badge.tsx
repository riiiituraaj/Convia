"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/ui";

export interface BadgeProps {
  tone?: Tone;
  /** Prepends a small semantic dot. */
  dot?: boolean;
  icon?: LucideIcon;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  tone = "neutral",
  dot = false,
  icon: Icon,
  size = "sm",
  className,
  children,
}) => {
  const style = toneClasses(tone);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        style.badge,
        className
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} /> : null}
      {Icon ? <Icon className="h-3 w-3" strokeWidth={1.75} /> : null}
      {children}
    </span>
  );
};

export interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  dot?: boolean;
  icon?: LucideIcon;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, ...rest }) => (
  <Badge {...rest}>{label}</Badge>
);
