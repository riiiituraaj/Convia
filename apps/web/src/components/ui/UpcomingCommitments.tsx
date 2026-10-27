"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { calendarChip, dueInfo, sortByDeadline, toneClasses } from "@/lib/ui";
import type { Commitment } from "@/lib/types";
import { Card, CardHeader } from "./Card";
import { EmptyState } from "./EmptyState";
import { Badge } from "./Badge";

export interface UpcomingCommitmentsProps {
  commitments: Commitment[];
  limit?: number;
  className?: string;
  /** Renders the "View all" action in the header. */
  href?: string;
  hrefLabel?: string;
}

/**
 * Timeline list of the nearest commitments: date chip, title, category
 * and a semantic due indicator.
 */
export const UpcomingCommitments: React.FC<UpcomingCommitmentsProps> = ({
  commitments,
  limit = 5,
  className,
  href,
  hrefLabel = "View all",
}) => {
  const ordered = sortByDeadline(commitments).slice(0, limit);

  return (
    <Card className={className}>
      <CardHeader
        icon={<CalendarClock className="h-4 w-4" strokeWidth={1.8} />}
        title="Upcoming commitments"
        subtitle="Sorted by the nearest deadline"
        action={
          href ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand transition-colors hover:text-brand-deep"
            >
              {hrefLabel}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
            </Link>
          ) : null
        }
      />

      {ordered.length === 0 ? (
        <div className="px-5 py-5 sm:px-6">
          <EmptyState
            icon={CalendarClock}
            title="Nothing scheduled"
            description="Once CONVIA detects commitments with deadlines, they appear here in order."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {ordered.map((commitment) => {
            const chip = calendarChip(commitment.deadline);
            const due = dueInfo(commitment.deadline, commitment.status);
            const tone = toneClasses(due.tone);

            return (
              <li
                key={commitment.id}
                className="flex items-start gap-3.5 px-5 py-3.5 transition-colors duration-150 ease-out hover:bg-surface-muted sm:px-6"
              >
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[10px] border border-line bg-surface-muted leading-none">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    {chip.month}
                  </span>
                  <span className="text-[15px] font-semibold text-ink">{chip.day}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">{commitment.action}</p>
                  <p className="mt-0.5 truncate text-[12px] text-ink-secondary">
                    {[commitment.context || commitment.recipient || "Personal", due.label]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", tone.dot)} aria-hidden="true" />
                  <Badge tone={due.tone}>{due.isOverdue ? "Urgent" : chip.month === "---" ? "Open" : "Tracked"}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
