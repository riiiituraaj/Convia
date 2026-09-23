"use client";

import React, { useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Cpu,
  ListTree,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AgentRun } from "@/lib/types";
import { formatDateTime } from "@/lib/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

function runTone(status: string) {
  if (status === "FAILED") return "danger" as const;
  if (status === "WAITING_APPROVAL") return "warning" as const;
  if (status === "COMPLETED") return "success" as const;
  return "info" as const;
}

export default function AgentsPage() {
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["agentRuns"],
    queryFn: () => api.getAgentRuns(),
  });

  const completed = runs.filter((run) => run.status === "COMPLETED").length;
  const waiting = runs.filter((run) => run.status === "WAITING_APPROVAL").length;
  const failed = runs.filter((run) => run.status === "FAILED").length;
  const avgLatency = runs.length
    ? Math.round(runs.reduce((sum, run) => sum + (run.latency_ms || 0), 0) / runs.length)
    : 0;

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Human-guided autonomy"
        title="Agent activity"
        description="See what CONVIA is thinking, doing and waiting for you to approve. Every run is inspectable."
        icon={<Bot className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total runs"
          value={runs.length}
          icon={Activity}
          tone="brand"
          hint="Across the continuity engine"
        />
        <StatCard
          label="Completed"
          value={completed}
          icon={CheckCircle2}
          tone="success"
          hint="Closed successfully"
        />
        <StatCard
          label="Needs approval"
          value={waiting}
          icon={Clock3}
          tone={waiting ? "warning" : "success"}
          hint={failed ? `${failed} failed run${failed === 1 ? "" : "s"}` : "Nothing blocked"}
        />
        <StatCard
          label="Avg latency"
          value={`${avgLatency}ms`}
          icon={Cpu}
          tone="info"
          hint="Mean recorded run time"
        />
      </div>

      <Card>
        <CardHeader
          title="Execution timeline"
          subtitle="Expand a run to inspect steps, model and latency."
          icon={<ListTree className="h-4 w-4" />}
        />
        {isLoading ? (
          <LoadingState label="Loading agent runs" rows={4} />
        ) : runs.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No agent runs yet"
            description="Capture an intent or seed the flagship demo to start the continuity engine."
          />
        ) : (
          <div className="divide-y divide-line-subtle">
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRun(run)}
                className="flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-pale text-brand">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{run.task_description}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {run.agent_type} · {run.model_used} · {run.latency_ms}ms ·{" "}
                      {formatDateTime(run.created_at)}
                    </p>
                    {run.events?.length ? (
                      <p className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-secondary">
                        <ChevronRight className="h-3 w-3" />
                        {run.events.length} step{run.events.length === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={runTone(run.status)} dot>
                    {run.status.replaceAll("_", " ")}
                  </Badge>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {failed > 0 ? (
        <p className="flex items-center gap-2 text-sm text-danger">
          <XCircle className="h-4 w-4" /> Failed runs remain visible for diagnosis.
        </p>
      ) : null}

      <Modal
        isOpen={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
        title={selectedRun?.agent_type || "Agent run"}
        subtitle={selectedRun?.task_description}
        eyebrow="Run detail"
        icon={<Bot className="h-4 w-4" strokeWidth={1.8} />}
        footer={
          <Button variant="outline" onClick={() => setSelectedRun(null)}>
            Close
          </Button>
        }
      >
        {selectedRun ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line-subtle bg-surface-muted p-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">Status</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {selectedRun.status.replaceAll("_", " ")}
                </p>
              </div>
              <div className="rounded-xl border border-line-subtle bg-surface-muted p-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">Latency</p>
                <p className="mt-1 text-sm font-semibold text-ink">{selectedRun.latency_ms}ms</p>
              </div>
              <div className="rounded-xl border border-line-subtle bg-surface-muted p-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">Model</p>
                <p className="mt-1 break-all text-sm font-semibold text-ink">
                  {selectedRun.model_used}
                  {/local-deterministic|fallback/i.test(selectedRun.model_used || "") ? (
                    <span className="ml-2 rounded-full border border-[#F7E2B8] bg-warning-light px-1.5 py-0.5 text-[10px] font-semibold text-[#B87A0E]">
                      Local mode
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="rounded-xl border border-line-subtle bg-surface-muted p-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">Started</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {formatDateTime(selectedRun.created_at)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                Steps
              </p>
              <ol className="mt-2 space-y-2">
                {(selectedRun.events || []).map((event, index) => (
                  <li
                    key={`${selectedRun.id}-${index}`}
                    className="flex items-start gap-2.5 rounded-lg border border-line-subtle bg-surface-muted px-3 py-2 text-[12.5px] text-ink-secondary"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-pale text-[10px] font-bold text-brand">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      {event.step || event.message || JSON.stringify(event)}
                    </span>
                  </li>
                ))}
                {!selectedRun.events?.length ? (
                  <li className="text-[12.5px] text-ink-muted">No step events recorded.</li>
                ) : null}
              </ol>
            </div>

            {selectedRun.output_payload &&
            Object.keys(selectedRun.output_payload).length > 0 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                  Output
                </p>
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-line-subtle bg-surface-sunken p-3 text-[11.5px] text-ink-secondary">
                  {JSON.stringify(selectedRun.output_payload, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
