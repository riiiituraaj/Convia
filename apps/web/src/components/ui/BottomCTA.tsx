"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomCTAProps {
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  icon?: React.ReactNode;
  className?: string;
}

/** Wide, subtle green banner used to close out long pages. */
export const BottomCTA: React.FC<BottomCTAProps> = ({
  title,
  description,
  actionLabel,
  href,
  icon,
  className,
}) => (
  <section
    className={cn(
      "flex flex-col gap-5 rounded-2xl border border-brand-light bg-convia-soft p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8",
      className
    )}
  >
    <div className="flex items-start gap-4">
      {icon ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/70 text-brand">
          {icon}
        </span>
      ) : null}
      <div>
        <h2 className="text-[19px] font-semibold tracking-tight text-brand-deep sm:text-[21px]">
          {title}
        </h2>
        <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-ink-secondary text-pretty">
          {description}
        </p>
      </div>
    </div>

    <Link
      href={href}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] bg-brand px-4 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-brand-deep"
    >
      {actionLabel}
      <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
    </Link>
  </section>
);
