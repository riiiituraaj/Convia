"use client";

import React from "react";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Compass,
  ListChecks,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Stage {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  /** The "Act" stage carries the pale-green highlight. */
  highlight?: boolean;
}

const STAGES: Stage[] = [
  {
    key: "intent",
    label: "Intent",
    description: "You speak or type what matters.",
    icon: Compass,
  },
  {
    key: "understand",
    label: "Understand",
    description: "Context, people and constraints are read.",
    icon: Brain,
  },
  {
    key: "plan",
    label: "Plan",
    description: "Outcomes become ordered, realistic steps.",
    icon: ListChecks,
  },
  {
    key: "act",
    label: "Act",
    description: "Work happens with your approval.",
    icon: Zap,
    highlight: true,
  },
  {
    key: "verify",
    label: "Verify",
    description: "Evidence confirms the loop really closed.",
    icon: BadgeCheck,
  },
  {
    key: "adapt",
    label: "Adapt",
    description: "CONVIA learns and protects the next loop.",
    icon: Sparkles,
  },
];

export interface ContinuityLoopProps {
  className?: string;
  /** Compact mode drops descriptions (used inside narrow columns). */
  compact?: boolean;
}

/**
 * The Continuity Loop — CONVIA's signature component.
 * Intent → Understand → Plan → Act → Verify → Adapt, with a return path.
 */
export const ContinuityLoop: React.FC<ContinuityLoopProps> = ({ className, compact = false }) => (
  <div className={cn("space-y-5", className)}>
    <div className="convia-scroll-x -mx-1 flex gap-3 overflow-x-auto px-1 pb-2 lg:gap-0">
      {STAGES.map((stage, index) => {
        const Icon = stage.icon;
        const isLast = index === STAGES.length - 1;

        return (
          <React.Fragment key={stage.key}>
            <div
              className={cn(
                "flex min-w-[164px] flex-1 flex-col rounded-xl border p-4 transition-colors duration-200 ease-out lg:min-w-0",
                stage.highlight
                  ? "border-brand-light bg-convia-soft"
                  : "border-line-subtle bg-surface-muted hover:border-line"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  stage.highlight
                    ? "border-brand-accent/30 bg-brand-accent text-white"
                    : "border-brand-light bg-brand-pale text-brand"
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>

              <p className="mt-3 text-[13.5px] font-semibold tracking-tight text-ink">
                {stage.label}
              </p>
              {!compact ? (
                <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                  {stage.description}
                </p>
              ) : null}
            </div>

            {!isLast ? (
              <span
                aria-hidden="true"
                className="hidden shrink-0 items-center self-center px-1.5 text-line-strong lg:flex"
              >
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </span>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>

    {/* Return path that closes the loop */}
    <div className="relative hidden lg:block">
      <svg viewBox="0 0 1000 42" preserveAspectRatio="none" className="h-10 w-full">
        <defs>
          <linearGradient id="convia-loop-return" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#25A866" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#25A866" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#25A866" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <path
          d="M 988 4 C 988 34, 500 40, 12 34"
          fill="none"
          stroke="url(#convia-loop-return)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="12" cy="34" r="3" fill="#25A866" fillOpacity="0.5" />
      </svg>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-muted">
        Continuous loop
      </span>
    </div>
  </div>
);
