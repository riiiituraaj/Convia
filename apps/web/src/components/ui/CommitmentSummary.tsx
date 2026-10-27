"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { Commitment } from "@/lib/types";
import { isClosed, toneClasses } from "@/lib/ui";
import { Card, CardHeader } from "./Card";

export interface CommitmentSummaryCardProps {
  commitments: Commitment[];
  className?: string;
  href?: string;
}

/** A compact count of saved commitment statuses and explicitly saved risk labels. */
export const CommitmentSummaryCard: React.FC<CommitmentSummaryCardProps> = ({
  commitments,
  className,
  href = "/commitments",
}) => {
  const completed = commitments.filter((item) => isClosed(item.status)).length;
  const open = commitments.length - completed;
  const atRisk = commitments.filter(
    (item) =>
      !isClosed(item.status) &&
      (item.status === "AT_RISK" || item.risk_level === "HIGH" || item.risk_level === "CRITICAL")
  ).length;
  const rows = [
    { label: "Completed", value: completed, tone: "success" as const },
    { label: "Open", value: open, tone: "brand" as const },
    { label: "Saved as risk", value: atRisk, tone: "danger" as const },
  ];
  const max = Math.max(commitments.length, 1);

  return (
    <Card className={className}>
      <CardHeader
        icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />}
        title="Commitment summary"
        subtitle="Counts from saved status and risk labels"
      />
      <div className="space-y-3 px-5 py-5 sm:px-6">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[11.5px] text-ink-muted">{row.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <span
                className="block h-full rounded-full"
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
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 border-t border-line-subtle pt-3 text-[12.5px] font-medium text-brand transition-colors hover:text-brand-deep"
          >
            Review commitments
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
          </Link>
        ) : null}
      </div>
    </Card>
  );
};
