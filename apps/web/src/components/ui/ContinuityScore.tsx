"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Gauge } from "lucide-react";
import type { ContinuityScore } from "@/lib/ui";
import { toneClasses } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "./Card";
import { ProgressRing } from "./Progress";

export interface ContinuityScoreCardProps {
  score: ContinuityScore;
  className?: string;
  href?: string;
}

const BAND_LABEL: Record<string, string> = {
  success: "Excellent",
  brand: "Good",
  warning: "Watch",
  danger: "At risk",
};

/** Circular continuity score with a transparent breakdown underneath. */
export const ContinuityScoreCard: React.FC<ContinuityScoreCardProps> = ({
  score,
  className,
  href = "/commitments",
}) => {
  const style = toneClasses(score.band);

  const rows = [
    { label: "Closed", value: score.completed, tone: "success" as const },
    { label: "Active", value: score.active, tone: "brand" as const },
    { label: "At risk", value: score.atRisk, tone: "danger" as const },
  ];

  const max = Math.max(score.total, 1);

  return (
    <Card className={className}>
      <CardHeader
        icon={<Gauge className="h-4 w-4" strokeWidth={1.8} />}
        title="Continuity score"
        subtitle="Derived from commitment health"
      />

      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-center gap-5">
          <ProgressRing value={score.score} tone={score.band} size={116} stroke={9}>
            <span className="text-[26px] font-semibold leading-none tracking-tight text-ink">
              {score.score}
            </span>
            <span className="mt-1 text-[11px] text-ink-muted">/100</span>
          </ProgressRing>

          <div className="min-w-0">
            <p className={cn("text-[13.5px] font-semibold", style.text)}>
              {BAND_LABEL[score.band] ?? "Tracked"}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
              {score.interpretation}
            </p>
            {href ? (
              <Link
                href={href}
                className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand transition-colors hover:text-brand-deep"
              >
                Review commitments
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-5 space-y-2.5 border-t border-line-subtle pt-4">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-[11.5px] text-ink-muted">{row.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                <span
                  className="block h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.round((row.value / max) * 100)}%`,
                    backgroundColor: toneClasses(row.tone).hex,
                  }}
                />
              </span>
              <span className="w-6 shrink-0 text-right text-[12px] font-medium text-ink">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
