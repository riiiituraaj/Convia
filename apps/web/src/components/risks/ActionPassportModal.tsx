"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { ActionPassport } from "@/lib/types";
import { api } from "@/lib/api";
import { prettyLabel, riskTone } from "@/lib/ui";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

interface ActionPassportModalProps {
  passport: ActionPassport | null;
  isOpen: boolean;
  onClose: () => void;
  onActionDecided?: () => void;
}

/**
 * Action Passport: record a user's decision on a proposed operation.
 * No external execution handler is connected in this build.
 */
export const ActionPassportModal: React.FC<ActionPassportModalProps> = ({
  passport,
  isOpen,
  onClose,
  onActionDecided,
}) => {
  const [loading, setLoading] = useState(false);
  const [decidedPassport, setDecidedPassport] = useState<ActionPassport | null>(null);
  const { toast } = useToast();

  // A new passport always starts from the server state.
  useEffect(() => {
    setDecidedPassport(null);
  }, [passport?.id]);

  if (!isOpen || !passport) return null;

  const current = decidedPassport || passport;
  const isPending = current.status === "PENDING_APPROVAL";
  const isLegacyExecutionStatus = current.status === "EXECUTED" || current.status === "VERIFIED";

  const handleDecision = async (decision: "APPROVE" | "REJECT") => {
    try {
      setLoading(true);
      const res = await api.decideAction(current.id, decision);
      setDecidedPassport(res);
      toast({
        title: decision === "APPROVE" ? "Approval recorded" : "Proposal rejected",
        description: res.execution_result?.message || "Your decision has been saved.",
        tone: decision === "APPROVE" ? "success" : "info",
      });
      if (onActionDecided) onActionDecided();
    } catch (error) {
      toast({
        title: "Could not save your decision",
        description: error instanceof Error ? error.message : "The server rejected the request.",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Action passport"
      subtitle="Autonomy control & human approval"
      eyebrow={isPending ? "Awaiting your decision" : "Decision recorded"}
      icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.8} />}
      maxWidth="md"
      footer={
        isPending ? (
          <>
            <Button variant="outline" onClick={() => handleDecision("REJECT")} disabled={loading}>
              <XCircle className="h-4 w-4" strokeWidth={1.9} />
              Decline action
            </Button>
            <Button onClick={() => handleDecision("APPROVE")} loading={loading}>
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.9} />
              Approve proposal
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Proposed action
          </p>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">
            {current.action_name}
          </p>
        </div>

        <div className="grid gap-4 rounded-xl border border-line bg-surface-muted p-4 sm:grid-cols-2">
          <div>
            <p className="text-[11.5px] text-ink-muted">Why this is needed</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink">{current.why}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-ink-muted">Expected impact</p>
            <p className="mt-1 text-[13px] leading-relaxed font-medium text-brand-mid">
              {current.expected_impact}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Supporting evidence
          </p>
          <ul className="mt-2 space-y-1.5">
            {current.evidence.map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-2.5 rounded-[10px] border border-line-subtle bg-surface p-2.5 text-[12.5px] leading-relaxed text-ink-secondary"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-muted p-3.5">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-secondary">
            Risk
            <Badge tone={riskTone(current.risk_level)}>{prettyLabel(current.risk_level)}</Badge>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-secondary">
            Reversible
            <Badge tone={current.is_reversible ? "success" : "warning"}>
              {current.is_reversible ? "Yes" : "No"}
            </Badge>
          </span>
          <StatusBadge
            tone={
              isLegacyExecutionStatus
                ? "warning"
                : isPending
                  ? "warning"
                  : current.status === "REJECTED"
                    ? "danger"
                    : "success"
            }
            dot
            label={isLegacyExecutionStatus ? "Legacy status" : prettyLabel(current.status)}
          />
        </div>

        {isLegacyExecutionStatus ? (
          <div className="rounded-xl border border-[#F7E2B8] bg-warning-light p-4 text-[13px] leading-relaxed text-ink-secondary">
            This older record has a “{prettyLabel(current.status)}” status. The current build has no connected action or verification handler, so that status is not confirmed here.
          </div>
        ) : null}

        {current.status === "APPROVED" ? (
          <div className="rounded-xl border border-info/20 bg-info-light p-4 text-[13px] leading-relaxed text-ink-secondary">
            Approval is recorded. No external action ran because this proposal has no connected execution handler.
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
