"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Info, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ActionPassportModal } from "@/components/risks/ActionPassportModal";
import { useToast } from "@/components/ui/Toast";
import type { ActionPassport } from "@/lib/types";

export default function DecisionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedPassport, setSelectedPassport] = React.useState<ActionPassport | null>(null);
  const [isPassportOpen, setIsPassportOpen] = React.useState(false);

  const { data: passports = [], isLoading } = useQuery({
    queryKey: ["actions"],
    queryFn: () => api.getActions(),
  });

  const pendingPassports = passports.filter((p) => p.status === "PENDING_APPROVAL");
  const approvedPassports = passports.filter((p) => p.status === "APPROVED");
  const rejectedPassports = passports.filter((p) => p.status === "REJECTED");
  const executedPassports = passports.filter((p) => p.status === "EXECUTED" || p.status === "VERIFIED");

  const decideMutation = useMutation({
    mutationFn: ({ passportId, decision }: { passportId: string; decision: "APPROVE" | "REJECT" }) =>
      api.decideAction(passportId, decision),
    onSuccess: (_, { decision }) => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      toast({
        title: decision === "APPROVE" ? "Action approved" : "Action rejected",
        description: decision === "APPROVE"
          ? "CONVIA will execute the action and verify the outcome."
          : "The action passport has been dismissed.",
      });
      setIsPassportOpen(false);
      setSelectedPassport(null);
    },
    onError: () =>
      toast({
        title: "Could not process decision",
        description: "The server rejected the request.",
        tone: "danger",
      }),
  });

  const handleOpenPassport = (passport: ActionPassport) => {
    setSelectedPassport(passport);
    setIsPassportOpen(true);
  };

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Human approval layer"
        title="Decisions"
        description="CONVIA prepares actions. You decide what moves forward. Nothing executes without you."
        icon={<ShieldAlert className="h-5 w-5" strokeWidth={1.75} />}
        meta={
          <>
            <Badge tone="warning" dot>{pendingPassports.length} pending</Badge>
            <Badge tone="success">{approvedPassports.length} approved</Badge>
            <Badge tone="neutral">{rejectedPassports.length} rejected</Badge>
          </>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading decisions" rows={2} />
      ) : pendingPassports.length === 0 && approvedPassports.length === 0 && rejectedPassports.length === 0 && executedPassports.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No decisions needed"
          description="When CONVIA prepares an action that needs your approval, it will appear here."
        />
      ) : (
        <>
          {/* Pending approvals */}
          {pendingPassports.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold text-ink">Awaiting your decision</h2>
                <Badge tone="warning" dot>{pendingPassports.length}</Badge>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {pendingPassports.map((passport) => (
                  <Card key={passport.id} interactive className="p-5 sm:p-6 border-warning/20" onClick={() => handleOpenPassport(passport)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-warning-light bg-warning-light text-[#B87A0E]">
                          <ShieldAlert className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="warning" dot>Pending approval</Badge>
                            <Badge tone={passport.risk_level === "HIGH" ? "danger" : passport.risk_level === "MEDIUM" ? "warning" : "success"} dot>
                              {passport.risk_level} risk
                            </Badge>
                            {passport.is_reversible && <Badge tone="neutral">Reversible</Badge>}
                          </div>
                          <h3 className="mt-2 text-[15px] font-semibold tracking-tight text-ink truncate">
                            {passport.action_name}
                          </h3>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                            {passport.why}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-ink-muted">
                            {passport.evidence.slice(0, 2).map((evidence, index) => (
                              <span key={index} className="flex items-center gap-1.5">
                                <Info className="h-3 w-3" strokeWidth={1.8} />
                                {evidence.length > 80 ? evidence.slice(0, 80) + "…" : evidence}
                              </span>
                            ))}
                            {passport.evidence.length > 2 && (
                              <span className="text-ink-muted">+{passport.evidence.length - 2} more</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenPassport(passport); }}
                          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand px-3 py-2 text-[12.5px] font-medium text-white hover:bg-brand-deep transition-colors"
                        >
                          Review
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); decideMutation.mutate({ passportId: passport.id, decision: "APPROVE" }); }}
                            className="inline-flex items-center gap-1.5 rounded-[10px] border border-success bg-success/10 px-3 py-2 text-[12.5px] font-medium text-success hover:bg-success/20 transition-colors"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); decideMutation.mutate({ passportId: passport.id, decision: "REJECT" }); }}
                            className="inline-flex items-center gap-1.5 rounded-[10px] border border-danger bg-danger/10 px-3 py-2 text-[12.5px] font-medium text-danger hover:bg-danger/20 transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" strokeWidth={2} />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* History */}
          {(approvedPassports.length > 0 || rejectedPassports.length > 0 || executedPassports.length > 0) && (
            <section className="space-y-4">
              <h2 className="text-[15px] font-semibold text-ink">Decision history</h2>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {approvedPassports.map((passport) => (
                  <Card key={passport.id} className="p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-success-light bg-success-light text-success">
                        <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[13.5px] font-semibold text-ink truncate">{passport.action_name}</h3>
                        <p className="text-[12px] text-ink-secondary">Approved · {passport.executed_at ? formatDateTime(passport.executed_at) : "Pending execution"}</p>
                      </div>
                    </div>
                  </Card>
                ))}
                {rejectedPassports.map((passport) => (
                  <Card key={passport.id} className="p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-danger-light bg-danger-light text-danger">
                        <XCircle className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[13.5px] font-semibold text-ink truncate">{passport.action_name}</h3>
                        <p className="text-[12px] text-ink-secondary">Rejected · {passport.created_at ? formatDateTime(passport.created_at) : ""}</p>
                      </div>
                    </div>
                  </Card>
                ))}
                {executedPassports.map((passport) => (
                  <Card key={passport.id} className="p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-brand-light bg-brand-pale text-brand-deep">
                        <ShieldAlert className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[13.5px] font-semibold text-ink truncate">{passport.action_name}</h3>
                        <p className="text-[12px] text-ink-secondary">
                          {passport.status === "VERIFIED" ? "Executed & verified" : "Executed"} · {passport.verified_at ? formatDateTime(passport.verified_at) : passport.executed_at ? formatDateTime(passport.executed_at) : ""}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <Card>
            <CardBody>
              <p className="text-[12.5px] leading-relaxed text-ink-secondary">
                Every meaningful action in CONVIA creates an <strong>Action Passport</strong> — a structured record
                explaining what the action is, why it&apos;s needed, the evidence, risk level, reversibility, and what
                happens if you approve or reject it. This is your approval layer. CONVIA never acts without you.
              </p>
            </CardBody>
          </Card>
        </>
      )}

      <ActionPassportModal
        passport={selectedPassport}
        isOpen={isPassportOpen}
        onClose={() => setIsPassportOpen(false)}
        onActionDecided={() => {
          queryClient.invalidateQueries({ queryKey: ["actions"] });
          queryClient.invalidateQueries({ queryKey: ["commitments"] });
          queryClient.invalidateQueries({ queryKey: ["risks"] });
        }}
      />
    </div>
  );
}