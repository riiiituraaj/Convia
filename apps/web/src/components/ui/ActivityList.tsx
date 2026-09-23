"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime, toneClasses, type Tone } from "@/lib/ui";
import { Card, CardHeader } from "./Card";
import { EmptyState } from "./EmptyState";

export interface ActivityItem {
  id: string;
  icon: LucideIcon;
  title: string;
  source: string;
  timestamp: string;
  tone?: Tone;
}

export interface ActivityListProps {
  items: ActivityItem[];
  title?: string;
  subtitle?: string;
  className?: string;
  /** Limits the number of visible rows. */
  limit?: number;
}

/** Clean activity timeline: icon, event, source, relative time. */
export const ActivityList: React.FC<ActivityListProps> = ({
  items,
  title = "Recent activity",
  subtitle = "What CONVIA has been doing for you",
  className,
  limit = 6,
}) => {
  const visible = items.slice(0, limit);

  return (
    <Card className={className}>
      <CardHeader
        icon={<History className="h-4 w-4" strokeWidth={1.8} />}
        title={title}
        subtitle={subtitle}
      />

      {visible.length === 0 ? (
        <div className="px-5 py-5 sm:px-6">
          <EmptyState
            icon={History}
            title="No activity yet"
            description="Agent runs and continuity events will be listed here as they happen."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {visible.map((item) => {
            const Icon = item.icon;
            const style = toneClasses(item.tone ?? "brand");
            return (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                    style.soft,
                    style.text
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-snug text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-muted">{item.source}</p>
                </div>

                <span className="shrink-0 text-[11.5px] text-ink-muted">
                  {relativeTime(item.timestamp)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
