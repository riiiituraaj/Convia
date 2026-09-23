"use client";

import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleCheckBig,
  Clock,
  Pencil,
  Repeat,
  ShieldAlert,
  User,
} from "lucide-react";
import type { Commitment } from "@/lib/types";
import { commitmentStatusTone, dueInfo, prettyLabel, priorityTone, riskTone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface CommitmentCardProps {
  commitment: Commitment;
  onStatusChange?: (id: string, newStatus: string) => void;
  onInspectRisk?: (commitment: Commitment) => void;
  onEdit?: (commitment: Commitment) => void;
}

/**
 * The CONVIA commitment card: status, risk, reason and the loop-closing action.
 */
export const CommitmentCard: React.FC<CommitmentCardProps> = ({
  commitment,
  onStatusChange,
  onInspectRisk,
  onEdit,
}) => {
  const due = dueInfo(commitment.deadline, commitment.status);
  const isComplete =
    commitment.status === "CLOSED" ||
    commitment.status === "COMPLETED" ||
    commitment.status === "VERIFIED";

  const needsRecovery =
    commitment.risk_level === "HIGH" ||
    commitment.risk_level === "CRITICAL" ||
    commitment.status === "AT_RISK" ||
    commitment.status === "RECOVERY";

  return (
    <Card interactive padded className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={commitmentStatusTone(commitment.status)}
            dot
            label={prettyLabel(commitment.status)}
          />
          <Badge tone={priorityTone(commitment.priority)} icon={Repeat}>
            {prettyLabel(commitment.priority)} priority
          </Badge>
        </div>

        <Badge tone={riskTone(commitment.risk_level)} icon={AlertTriangle}>
          {prettyLabel(commitment.risk_level)} risk
        </Badge>
      </div>

      <h3 className="mt-3.5 text-[15px] font-semibold leading-snug tracking-tight text-ink">
        {commitment.action}
      </h3>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-ink-secondary">
        {commitment.recipient ? (
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.8} />
            <span className="text-ink">
              {commitment.recipient}
            </span>
          </span>
        ) : null}

        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.8} />
          <span className={cn(due.tone === "danger" && "font-medium text-danger")}>{due.label}</span>
        </span>

        {commitment.context ? (
          <span className="rounded-md bg-surface-sunken px-2 py-0.5 text-[11.5px] text-ink-secondary">
            {commitment.context}
          </span>
        ) : null}
      </div>

      {commitment.consequences ? (
        <div className="mt-3.5 rounded-[10px] border border-line-subtle bg-surface-muted p-3 text-[12.5px] leading-relaxed text-ink-secondary">
          <span className="font-semibold text-ink">Consequence: </span>
          {commitment.consequences}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-subtle pt-3.5">
        <span className="text-[11.5px] text-ink-muted">
          Autonomy L{commitment.autonomy_level} · Confidence{" "}
          {Math.round((commitment.confidence ?? 0) * 100)}%
        </span>

        <div className="flex items-center gap-2">
          {onEdit && !isComplete ? (
            <Button size="sm" variant="ghost" onClick={() => onEdit(commitment)}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.9} />
              Edit
            </Button>
          ) : null}

          {needsRecovery && onInspectRisk ? (
            <Button
              size="sm"
              variant="warning"
              onClick={() => onInspectRisk(commitment)}
            >
              <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.9} />
              Recover
            </Button>
          ) : null}

          {!isComplete ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onStatusChange?.(commitment.id, "CLOSED")}
            >
              <CircleCheckBig className="h-3.5 w-3.5" strokeWidth={1.9} />
              Close loop
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-mid">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
              Thread closed
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};
