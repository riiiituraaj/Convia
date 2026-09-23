"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/ui";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  /** e.g. "2 this week" */
  trend?: string;
  trendDirection?: "up" | "down" | "flat";
  /** `down` is treated as positive for metrics where less is better. */
  trendPositive?: boolean;
  hint?: string;
  className?: string;
}

/**
 * Metric card from the CONVIA dashboard: icon container, large metric,
 * label and a small contextual trend indicator.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  tone = "brand",
  trend,
  trendDirection = "flat",
  trendPositive = true,
  hint,
  className,
}) => {
  const style = toneClasses(tone);

  const TrendIcon =
    trendDirection === "up" ? ArrowUpRight : trendDirection === "down" ? ArrowDownRight : Minus;

  const trendTone: Tone =
    trendDirection === "flat"
      ? "neutral"
      : (trendDirection === "up") === trendPositive
        ? "success"
        : "danger";

  return (
    <div
      className={cn(
        "group flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card transition-all duration-200 ease-out hover:-translate-y-px hover:border-line-strong hover:shadow-card-hover",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-[10px] border",
            style.soft,
            style.text
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              toneClasses(trendTone).badge
            )}
          >
            <TrendIcon className="h-3 w-3" strokeWidth={2} />
            {trend}
          </span>
        ) : null}
      </div>

      <div>
        <div className="text-[30px] font-semibold leading-none tracking-tight text-ink">
          {value}
        </div>
        <div className="mt-2 text-[13px] font-medium text-ink-secondary">{label}</div>
        {hint ? <div className="mt-1 text-[12px] text-ink-muted">{hint}</div> : null}
      </div>
    </div>
  );
};
