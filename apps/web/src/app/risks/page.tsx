"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { ActionPassport, RecoveryOption, Risk } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Modal } from "@/components/ui/Modal";
import { ActionPassportModal } from "@/components/risks/ActionPassportModal";
import { useToast } from "@/components/ui/Toast";

export default function RisksPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [selectedPassport, setSelectedPassport] = useState<ActionPassport | null>(null);
  const [isPassportOpen, setIsPassportOpen] = useState(false);

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ["risks"],
    queryFn: () => api.getRisks(),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["actions"],
    queryFn: () => api.getActions(),
  });

  const active = risks.filter((risk) => !risk.is_resolved);
  const critical = active.filter((risk) => risk.severity === "CRITICAL").length;

  const recoveryMutation = useMutation({
    mutationFn: ({ riskId, optionId }: { riskId: string; optionId: string }) =>
      api.executeRecovery(riskId, optionId),
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      const passport =
        (await api.getActions()).find((p) => p.id === result.passport_id) || null;
      setIsRecoveryOpen(false);
      setSelectedRisk(null);
      if (passport) {
        setSelectedPassport(passport);
        setIsPassportOpen(true);
      }
      toast({
        title: "Proposal created",
        description: "An action proposal was saved for review. No external action was run.",
      });
    },
    onError: () =>
      toast({
        title: "Could not start recovery",
        description: "The server rejected this recovery option.",
        tone: "danger",
      }),
  });

  const openRecovery = (risk: Risk) => {
    setSelectedRisk(risk);
    setIsRecoveryOpen(true);
  };

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Saved risk records"
        title="Risk center"
        description="Review saved risk records and create a proposal for a decision. Proposals do not run external actions."
        icon={<ShieldAlert className="h-5 w-5" />}
        meta={
          <>
            <Badge tone={active.length ? "warning" : "success"} dot>
              {active.length} active
            </Badge>
            {critical ? (
              <Badge tone="danger" dot>
                {critical} critical
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active risks"
          value={active.length}
          icon={ShieldAlert}
          tone={active.length ? "warning" : "success"}
          hint="Not yet resolved"
        />
        <StatCard
          label="Critical"
          value={critical}
          icon={AlertTriangle}
          tone={critical ? "danger" : "success"}
          hint="Immediate attention"
        />
        <StatCard
          label="Recovery options"
          value={active.reduce((sum, risk) => sum + risk.recovery_strategies.length, 0)}
          icon={ArrowRight}
          tone="info"
          hint="Suggestions available for review"
        />
      </div>

      {isLoading ? (
        <LoadingState label="Scanning risk" rows={4} />
      ) : active.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No saved risk records"
          description="Risk and recovery records are not inferred automatically from dependencies or constraints."
        />
      ) : (
        <div className="space-y-4">
          {active.map((risk) => (
            <Card key={risk.id}>
              <CardHeader
                title={risk.title}
                subtitle={risk.description}
                icon={<AlertTriangle className="h-4 w-4" />}
                action={
                  <Badge
                    tone={
                      risk.severity === "CRITICAL" || risk.severity === "HIGH"
                        ? "danger"
                        : "warning"
                    }
                    dot
                  >
                    {risk.severity}
                  </Badge>
                }
              />
              <CardBody>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-xl text-sm text-ink-secondary">Review signal from saved commitment details</p>
                  <Button variant="secondary" size="sm" onClick={() => openRecovery(risk)}>
                    Explore recovery
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {risk.evidence.length ? (
                  <p className="mt-4 border-l-2 border-warning pl-3 text-sm text-ink-secondary">
                    {risk.evidence[0]}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isRecoveryOpen}
        onClose={() => {
          setIsRecoveryOpen(false);
          setSelectedRisk(null);
        }}
        title="Recovery options"
        subtitle={selectedRisk?.title}
        eyebrow="Mitigation paths"
        icon={<Sparkles className="h-4 w-4" strokeWidth={1.8} />}
        maxWidth="lg"
      >
        {!selectedRisk || selectedRisk.recovery_strategies.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            No recovery strategies are prepared for this risk yet.
          </p>
        ) : (
          <div className="space-y-3">
            {selectedRisk.recovery_strategies.map((opt: RecoveryOption) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  recoveryMutation.mutate({ riskId: selectedRisk.id, optionId: opt.id })
                }
                disabled={recoveryMutation.isPending}
                className="w-full rounded-xl border border-line-subtle bg-surface-muted p-4 text-left transition-colors hover:border-brand hover:bg-brand-pale disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-sunken"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-ink">{opt.title}</span>
                  <span className="flex gap-1.5">
                    <Badge tone="neutral" size="sm">
                      {opt.action_type}
                    </Badge>
                    <Badge tone="neutral" size="sm">
                      Effort {opt.effort}
                    </Badge>
                  </span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">
                  {opt.description}
                </p>
                <p className="mt-2 text-[12px] font-medium text-brand-mid">
                  Expected: {opt.expected_outcome}
                </p>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <ActionPassportModal
        passport={selectedPassport}
        isOpen={isPassportOpen}
        onClose={() => setIsPassportOpen(false)}
        onActionDecided={() => {
          queryClient.invalidateQueries({ queryKey: ["actions"] });
          queryClient.invalidateQueries({ queryKey: ["risks"] });
          queryClient.invalidateQueries({ queryKey: ["commitments"] });
        }}
      />
    </div>
  );
}
