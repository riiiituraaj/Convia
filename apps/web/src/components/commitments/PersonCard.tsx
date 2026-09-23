"use client";

import React from "react";
import { Users, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { PersonProfile } from "@/lib/types";

interface PersonCardProps {
  person: PersonProfile;
}

export const PersonCard: React.FC<PersonCardProps> = ({ person }) => {
  const hasWaiting = person.waiting_on_user.length > 0;
  const hasUserWaiting = person.user_waiting_on.length > 0;

  return (
    <Card interactive className="p-5 sm:p-6 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-light bg-brand-pale text-brand-deep">
            <Users className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">{person.name}</h3>
            <p className="mt-0.5 text-[12px] text-ink-secondary">
              {person.open_commitments} open / {person.total_commitments} total
            </p>
          </div>
        </div>
        {hasWaiting ? (
          <Badge tone="warning" dot>
            Waiting on you
          </Badge>
        ) : hasUserWaiting ? (
          <Badge tone="info" dot>
            You are waiting
          </Badge>
        ) : (
          <Badge tone="success" dot>
            Clear
          </Badge>
        )}
      </div>

      {hasWaiting && (
        <div className="mt-4 space-y-2">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
            They&apos;re waiting on you
          </p>
          <ul className="space-y-1.5">
            {person.waiting_on_user.slice(0, 3).map((item, index) => (
              <li key={`${item.commitment_id}-${index}`} className="flex items-center gap-2 text-[12.5px] text-ink-secondary">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" strokeWidth={1.8} />
                <span className="font-medium text-ink">{item.action}</span>
                {item.deadline && (
                  <span className="ml-auto text-[11px] text-ink-muted">
                    <Clock className="h-3 w-3 inline-block align-middle mr-0.5" />
                    {new Date(item.deadline).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
            {person.waiting_on_user.length > 3 && (
              <li className="text-[12px] text-ink-muted">
                +{person.waiting_on_user.length - 3} more...
              </li>
            )}
          </ul>
        </div>
      )}

      {hasUserWaiting && (
        <div className="mt-4 space-y-2">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
            You&apos;re waiting on them
          </p>
          <ul className="space-y-1.5">
            {person.user_waiting_on.slice(0, 3).map((item, index) => (
              <li key={`${item.commitment_id}-${index}`} className="flex items-center gap-2 text-[12.5px] text-ink-secondary">
                <Clock className="h-3.5 w-3.5 shrink-0 text-info" strokeWidth={1.8} />
                <span className="font-medium text-ink">{item.action}</span>
              </li>
            ))}
            {person.user_waiting_on.length > 3 && (
              <li className="text-[12px] text-ink-muted">
                +{person.user_waiting_on.length - 3} more...
              </li>
            )}
          </ul>
        </div>
      )}

      {!hasWaiting && !hasUserWaiting && (
        <div className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-secondary">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={1.8} />
          <span>No open loops with {person.name}</span>
        </div>
      )}
    </Card>
  );
};