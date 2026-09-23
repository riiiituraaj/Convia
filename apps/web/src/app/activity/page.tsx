"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  ShieldAlert,
  CalendarCheck,
  Sparkles,
  Brain,
  Search,
  Link2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import type { AgentRun } from "@/lib/types";

const AGENT_ICONS: Record<string, React.ElementType> = {
  ORCHESTRATOR: Bot,
  CONTEXT: Brain,
  CONTEXT_AGENT: Brain,
  COMMITMENT: Link2,
  COMMITMENT_AGENT: Link2,
  PLANNING: Search,
  PLANNING_AGENT: Search,
  RESEARCH: Search,
  RESEARCH_AGENT: Search,
  RISK: ShieldAlert,
  RISK_AGENT: ShieldAlert,
  CRITIC: AlertTriangle,
  CRITIC_AGENT: AlertTriangle,
  EXECUTION: Bot,
  EXECUTION_AGENT: Bot,
  VERIFICATION: CheckCircle2,
  VERIFICATION_AGENT: CheckCircle2,
};

const AGENT_LABELS: Record<string, string> = {
  ORCHESTRATOR: "Orchestrator",
  CONTEXT: "Context",
  CONTEXT_AGENT: "Context",
  COMMITMENT: "Commitment",
  COMMITMENT_AGENT: "Commitment",
  PLANNING: "Planning",
  PLANNING_AGENT: "Planning",
  RESEARCH: "Research",
  RESEARCH_AGENT: "Research",
  RISK: "Risk",
  RISK_AGENT: "Risk",
  CRITIC: "Critic",
  CRITIC_AGENT: "Critic",
  EXECUTION: "Execution",
  EXECUTION_AGENT: "Execution",
  VERIFICATION: "Verification",
  VERIFICATION_AGENT: "Verification",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  RUNNING: Sparkles,
  COMPLETED: CheckCircle2,
  FAILED: XCircle,
  WAITING_APPROVAL: AlertTriangle,
};

const STATUS_TONES: Record<string, "brand" | "success" | "danger" | "warning" | "neutral" | "info"> = {
  RUNNING: "brand",
  COMPLETED: "success",
  FAILED: "danger",
  WAITING_APPROVAL: "warning",
};

export default function ActivityPage() {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["agentRuns"],
    queryFn: () => api.getAgentRuns(),
  });

  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const recentRuns = sortedRuns.slice(0, 20);

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="System telemetry"
        title="Activity"
        description="Every agent execution, tool call, and state change. Transparency into what CONVIA is doing on your behalf."
        icon={<Bot className="h-5 w-5" strokeWidth={1.75} />}
        meta={
          <>
            <Badge tone="brand" dot>{runs.length} total runs</Badge>
            <Badge tone="success">{runs.filter(r => r.status === "COMPLETED").length} completed</Badge>
            <Badge tone="danger">{runs.filter(r => r.status === "FAILED").length} failed</Badge>
          </>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading activity" rows={3} />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No activity yet"
          description="Agent runs will appear here as CONVIA processes your intents and monitors commitments."
        />
      ) : (
        <>
          <div className="space-y-3">
            {recentRuns.map((run, index) => {
              const Icon = AGENT_ICONS[run.agent_type] || Bot;
              const StatusIcon = STATUS_ICONS[run.status] || Sparkles;
              const tone = STATUS_TONES[run.status] || "neutral";
              const label = AGENT_LABELS[run.agent_type] || run.agent_type;

              return (
                <Card key={run.id} className="p-4 sm:p-5 hover:bg-surface-sunken transition-colors" interactive>
                  <div className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-light bg-brand-pale text-brand-deep">
                      <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge tone="brand" size="sm">{label}</Badge>
                          <Badge tone={tone} size="sm" dot>{run.status}</Badge>
                        </div>
                        <span className="text-[12px] text-ink-muted shrink-0">{formatDateTime(run.created_at)}</span>
                      </div>
                      <p className="mt-1.5 text-[13.5px] font-medium text-ink">{run.task_description}</p>
                      <p className="mt-1 text-[12px] text-ink-secondary">
                        {run.model_used} · {Math.round(run.latency_ms || 0)}ms
                        {/local-deterministic|fallback/i.test(run.model_used || "") ? (
                          <span className="ml-2 rounded-full border border-[#F7E2B8] bg-warning-light px-1.5 py-0.5 text-[10px] font-semibold text-[#B87A0E]">
                            Local mode
                          </span>
                        ) : null}
                      </p>
                      {run.events && run.events.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {run.events.slice(0, 4).map((event, eventIndex) => (
                            <Badge key={eventIndex} tone="neutral" size="sm">
                              {typeof event === "string" ? event : event.step || "step"}
                            </Badge>
                          ))}
                          {run.events.length > 4 && (
                            <Badge tone="neutral" size="sm">+{run.events.length - 4} more</Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 flex h-6 w-6 items-center justify-center text-ink-muted">
                      <StatusIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          {sortedRuns.length > 20 && (
            <Card>
              <CardBody className="text-center py-4">
                <p className="text-[13px] text-ink-secondary">
                  Showing 20 of {sortedRuns.length} runs.
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <p className="text-[12.5px] leading-relaxed text-ink-secondary">
                Activity shows every agent execution in the continuity loop. Each run represents a step in
                <strong>INTENT → UNDERSTAND → MODEL → PLAN → ACT → OBSERVE → VERIFY → ADAPT → CLOSE</strong>.
                Failed runs are preserved for debugging and never silently discarded.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}