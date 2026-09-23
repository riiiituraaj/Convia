"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/ui";

export interface AvatarProps {
  name: string | undefined | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-12 w-12 text-[15px]",
} as const;

/** Identity chip used in the top bar, hero and settings. */
export const Avatar: React.FC<AvatarProps> = ({ name, size = "md", className }) => (
  <span
    aria-hidden="true"
    className={cn(
      "inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold uppercase tracking-wide text-white",
      SIZES[size],
      className
    )}
  >
    {initials(name)}
  </span>
);
