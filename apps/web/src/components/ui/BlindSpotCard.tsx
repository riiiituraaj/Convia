"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, EyeOff, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "./Card";
import { Badge } from "./Badge";
import { EmptyState } from "./EmptyState";

export interface BlindSpotItem {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
}

export interface BlindSpotCardProps {
  total: number;
  items: BlindSpotItem[];
  className?: string;
  emptyLabel?: string;
  /** Tones follow the source of the blind spot: waiting people / closing windows. */
  tone?: "warning" | "danger";
  icon?: LucideIcon;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

/**
 * Warning-focused card for the blind spot scan.
 * Informative rather than alarming: pale surfaces, precise language.
 */
export const BlindSpotCard: React.FC<BlindSpotCardProps> = ({
  total,
  items,
  className,
  emptyLabel = "No blind spots detected right now.",
  tone = "warning",
  icon: HeaderIcon,
  title = "Blind spot scan",
  subtitle = "Things you may not be noticing",
  footer,
}) => {
  const isDanger = tone === "danger";

  return (
    <Card className={className}>
      <CardHeader
        icon={<EyeOff className="h-4 w-4" strokeWidth={1.8} />}
        title={title}
        subtitle={subtitle}
        action={
          <Badge tone={total > 0 ? tone : "success"} dot>
            {total > 0 ? `${total} found` : "Clear"}
          </Badge>
        }
      />

      <div className="px-5 py-4 sm:px-6">
        {items.length === 0 ? (
          <div className="flex items-start gap-2.5 rounded-[10px] border border-brand-light bg-brand-pale p-3.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" strokeWidth={2} />
            <p className="text-[13px] leading-relaxed text-ink-secondary">{emptyLabel}</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "rounded-[10px] border p-3.5",
                  isDanger ? "border-[#F8D4D4] bg-danger-light" : "border-[#F7E2B8] bg-warning-light"
                )}
              >
                <div className="flex items-start gap-2.5">
                  {HeaderIcon ? (
                    <HeaderIcon
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        isDanger ? "text-danger" : "text-[#B87A0E]"
                      )}
                      strokeWidth={2}
                    />
                  ) : (
                    <XCircle
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        isDanger ? "text-danger" : "text-[#B87A0E]"
                      )}
                      strokeWidth={2}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium leading-snug text-ink">{item.title}</p>
                    {item.detail ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                        {item.detail}
                      </p>
                    ) : null}
                    {item.meta ? (
                      <p
                        className={cn(
                          "mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                          isDanger ? "text-danger" : "text-[#B87A0E]"
                        )}
                      >
                        {item.meta}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {footer ? <div className="mt-4">{footer}</div> : null}
      </div>
    </Card>
  );
};
