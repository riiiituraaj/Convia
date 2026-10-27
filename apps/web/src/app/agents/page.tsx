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
  Pause,
  Play,
  RotateCcw,
  StopCircle,
  XCircle,
  Plus,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  if (status === "AWAITING_APPROVAL") return "warning" as const;
  if (status === "COMPLETED") return "success" as const;
  if (status === "RUNNING" || status === "PLANNING") return "brand" as const;
  if (status === "PAUSED") return "warning" as const;
  return "neutral" as const;
}

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["agentRuns"],
    queryFn: () => api.getAgentRuns(),
    refetchInterval: 3000,
  });

  const detailQuery = useQuery({
    queryKey: ["agentRunDetail", selectedRun?.id],
    queryFn: () => (selectedRun ? api.getAgentRun(selectedRun.id) : null),
    enabled: Boolean(selectedRun),
    refetchInterval: 2000,
  });

  const currentRunDetail = detailQuery.data || selectedRun;

  const createMutation = useMutation({
    mutationFn: (task: string) => api.createAgentRun(task),
    onSuccess: (newRun) => {
      setShowNewModal(false);
      setTaskInput("");
      setErrorMsg("");
      setSelectedRun(newRun);
      queryClient.invalidateQueries({ queryKey: ["agentRuns"] });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.pauseAgentRun(id),
    onSuccess: (updated) => {
      setSelectedRun(updated);
      queryClient.invalidateQueries({ queryKey: ["agentRuns"] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.resumeAgentRun(id),
    onSuccess: (updated) => {
      setSelectedRun(updated);
      queryClient.invalidateQueries({ queryKey: ["agentRuns"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelAgentRun(id),
    onSuccess: (updated) => {
      setSelectedRun(updated);
      queryClient.invalidateQueries({ queryKey: ["agentRuns"] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: ({ id, stepIdx }: { id: string; stepIdx: number }) => api.retryAgentStep(id, stepIdx),
    onSuccess: (updated) => {
      setSelectedRun(updated);
      queryClient.invalidateQueries({ queryKey: ["agentRuns"] });
    },
  });

  const completed = runs.filter((run) => run.status === "COMPLETED").length;
  const waiting = runs.filter((run) => run.status === "AWAITING_APPROVAL").length;
  const running = runs.filter((run) => run.status === "RUNNING" || run.status === "PLANNING").length;
  const failed = runs.filter((run) => run.status === "FAILED" || run.status === "PARTIALLY_COMPLETED").length;

  return (
    <div className="space-y-7 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          eyebrow="Persisted Agent Runner"
          title="Agent activity"
          description="Create a structured plan, run supported tools, and inspect saved step outcomes. Runs execute in this API request; approval records never execute external actions."
          icon={<Bot className="h-5 w-5" />}
        />
        <Button variant="primary" onClick={() => setShowNewModal(true)}>
          <Plus className="mr-2 h-4 w-4" /> Delegate task
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total runs"
          value={runs.length}
          icon={Activity}
          tone="brand"
          hint="Saved run and step state"
        />
        <StatCard
          label="Active / Planning"
          value={running}
          icon={Cpu}
          tone="info"
          hint="In progress"
        />
        <StatCard
          label="Needs approval"
          value={waiting}
          icon={Clock3}
          tone={waiting ? "warning" : "success"}
          hint="Awaiting explicit decision"
        />
        <StatCard
          label="Completed"
          value={completed}
          icon={CheckCircle2}
          tone="success"
          hint={`${failed} partial/failed`}
        />
      </div>

      <Card>
        <CardHeader
          title="Execution timeline"
          subtitle="Expand any task to inspect its plan, step statuses, available evidence, and execution controls."
          icon={<ListTree className="h-4 w-4" />}
        />
        {isLoading ? (
          <LoadingState label="Loading agent runs" rows={4} />
        ) : runs.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No agent runs yet"
            description="Delegate a bounded task such as document search or research. Live travel booking and other external actions are not connected."
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
                      {run.agent_type} · {run.model_used} · {formatDateTime(run.created_at)}
                    </p>
                    {run.events?.length ? (
                      <p className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-secondary">
                        <ChevronRight className="h-3 w-3" />
                        {run.events.length} event{run.events.length === 1 ? "" : "s"}
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

      {/* New Task Modal */}
      {showNewModal && (
        <Modal
          isOpen={showNewModal}
          onClose={() => setShowNewModal(false)}
          title="Delegate task to agent"
          subtitle="CONVIA saves a structured plan and runs supported tools. Approval requests pause for review; no external action is executed."
          eyebrow="New Execution"
          icon={<Bot className="h-4 w-4" />}
          footer={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!taskInput.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(taskInput)}
              >
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Start execution
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {errorMsg ? <p className="text-sm text-danger">{errorMsg}</p> : null}
            <label className="block text-xs font-semibold uppercase text-ink-muted">Task Objective</label>
            <textarea
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              rows={4}
              placeholder="e.g. 'Research Bangalore relocation costs, search relevant document vault files, and create a planned itinerary artifact'…"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </Modal>
      )}

      {/* Run Detail Modal */}
      <Modal
        isOpen={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
        title={currentRunDetail?.agent_type || "Agent run"}
        subtitle={currentRunDetail?.task_description}
        eyebrow="Saved Run Detail"
        icon={<Bot className="h-4 w-4" strokeWidth={1.8} />}
        footer={
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              {currentRunDetail?.status === "RUNNING" && (
                <Button
                  variant="outline"
                  onClick={() => pauseMutation.mutate(currentRunDetail.id)}
                  disabled={pauseMutation.isPending}
                >
                  <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
                </Button>
              )}
              {currentRunDetail?.status === "PAUSED" && (
                <Button
                  variant="primary"
                  onClick={() => resumeMutation.mutate(currentRunDetail.id)}
                  disabled={resumeMutation.isPending}
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" /> Resume
                </Button>
              )}
              {["RUNNING", "PAUSED", "AWAITING_APPROVAL", "PLANNING"].includes(currentRunDetail?.status || "") && (
                <Button
                  variant="danger"
                  onClick={() => currentRunDetail && cancelMutation.mutate(currentRunDetail.id)}
                  disabled={cancelMutation.isPending}
                >
                  <StopCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={() => setSelectedRun(null)}>
              Close
            </Button>
          </div>
        }
      >
        {currentRunDetail ? (
          <div className="space-y-5">
            {/* Run Status Header */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-line-subtle bg-surface-muted p-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">Status</p>
                <div className="mt-1">
                  <Badge tone={runTone(currentRunDetail.status)} dot>
                    {currentRunDetail.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl border border-line-subtle bg-surface-muted p-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">Model</p>
                <p className="mt-1 truncate text-xs font-semibold text-ink">{currentRunDetail.model_used}</p>
              </div>
              <div className="rounded-xl border border-line-subtle bg-surface-muted p-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">Steps</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {currentRunDetail.steps?.length || currentRunDetail.plan_json?.length || 0}
                </p>
              </div>
              <div className="rounded-xl border border-line-subtle bg-surface-muted p-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">Created</p>
                <p className="mt-1 text-xs font-semibold text-ink">{formatDateTime(currentRunDetail.created_at)}</p>
              </div>
            </div>

            {/* Approval Notice Banner */}
            {currentRunDetail.status === "AWAITING_APPROVAL" && (
              <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-pale p-4 text-sm text-ink">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="font-semibold text-warning-dark">Action Requires Approval</p>
                  <p className="mt-1 text-xs text-ink-secondary">
                    This run is paused awaiting your review. Go to the Actions page or review the passport to grant permission.
                  </p>
                </div>
              </div>
            )}

            {/* Structured Plan Steps Timeline */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                Execution Steps ({currentRunDetail.steps?.length || 0})
              </p>
              <div className="mt-2.5 space-y-2">
                {(currentRunDetail.steps || []).map((step) => {
                  const isDone = step.status === "COMPLETED";
                  const isAwaiting = step.status === "AWAITING_APPROVAL";
                  const isFail = step.status === "FAILED";
                  return (
                    <div
                      key={step.id}
                      className="rounded-xl border border-line bg-surface-muted p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-pale text-[10px] font-bold text-brand">
                            {step.step_index + 1}
                          </span>
                          <span className="font-semibold text-ink">{step.title}</span>
                          <span className="rounded bg-surface px-2 py-0.5 text-[10px] text-ink-muted">
                            {step.tool_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={runTone(step.status)} dot>
                            {step.status}
                          </Badge>
                          {isFail && (
                            <button
                              type="button"
                              onClick={() => retryMutation.mutate({ id: currentRunDetail.id, stepIdx: step.step_index })}
                              className="text-xs text-brand hover:underline"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                      {step.error_message && (
                        <p className="mt-2 text-danger">{step.error_message}</p>
                      )}
                      {step.output_payload && Object.keys(step.output_payload).length > 0 && (
                        <p className="mt-2 text-[11px] text-ink-secondary">
                          Result: {JSON.stringify(step.output_payload).slice(0, 150)}...
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Telemetry Events */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                Audit Trail ({currentRunDetail.events?.length || 0} events)
              </p>
              <ol className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {(currentRunDetail.events || []).map((event, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 rounded-lg bg-surface-sunken px-2.5 py-1.5 text-[11.5px] text-ink-secondary"
                  >
                    <span className="text-brand font-mono">•</span>
                    <span>{event.step || JSON.stringify(event)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
