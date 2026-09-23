"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleCheckBig,
  Layers,
  Target,
  Wallet,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { clampPercent, prettyLabel, riskTone, commitmentStatusTone } from "@/lib/ui";
import type { MissionNode } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MissionGraph } from "@/components/graph/MissionGraph";

export default function MissionControlPage() {
  const params = useParams<{ id: string }>();
  const [selectedNode, setSelectedNode] = useState<MissionNode | null>(null);
  const { data: mission, isLoading, isError } = useQuery({
    queryKey: ["mission", params.id],
    queryFn: () => api.getMission(params.id),
  });

  if (isLoading) return <LoadingState label="Loading mission control" rows={5} />;
  if (isError || !mission)
    return (
      <EmptyState
        icon={Target}
        title="Mission unavailable"
        description="This mission could not be loaded from the continuity engine."
        action={
          <Link className="text-sm font-semibold text-brand" href="/missions">
            Back to missions
          </Link>
        }
      />
    );

  const progress = clampPercent(mission.progress);
  const commitments = mission.commitments || [];
  const openCommitments = commitments.filter(
    (c) => c.status !== "CLOSED" && c.status !== "COMPLETED" && c.status !== "VERIFIED"
  );

  return (
    <div className="space-y-7 animate-fade-in">
      <Link
        href="/missions"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-secondary transition hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" />
        All missions
      </Link>

      <PageHeader
        eyebrow="Mission control"
        title={mission.title}
        description={
          mission.desired_outcome ||
          mission.description ||
          "A living map of the commitments behind this outcome."
        }
        icon={<Target className="h-5 w-5" />}
        meta={
          <>
            <Badge tone={mission.status === "AT_RISK" ? "danger" : "brand"} dot>
              {prettyLabel(mission.status)}
            </Badge>
            <Badge tone="neutral">{progress}% complete</Badge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-ink-muted">Progress</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{progress}%</p>
          <ProgressBar
            value={progress}
            tone={riskTone(mission.status === "AT_RISK" ? "HIGH" : "LOW")}
            className="mt-3"
            label="Mission progress"
          />
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink-muted">Open commitments</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {openCommitments.length}
            <span className="text-base font-medium text-ink-muted"> / {commitments.length}</span>
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-secondary">
            <CircleCheckBig className="h-3.5 w-3.5" />
            Threads tracked to closure
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink-muted">Constraint</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {mission.budget_limit ? formatCurrency(mission.budget_limit, mission.budget_currency) : "Open"}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-secondary">
            {mission.target_date ? (
              <>
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(mission.target_date)}
              </>
            ) : (
              <>
                <Wallet className="h-3.5 w-3.5" />
                No budget cap
              </>
            )}
          </p>
        </Card>
      </div>

      <Card>
        <CardBody className="p-3 sm:p-4">
          {mission.nodes?.length ? (
            <MissionGraph
              nodes={mission.nodes}
              edges={mission.edges || []}
              onSelectNode={(node) => setSelectedNode(node)}
            />
          ) : (
            <EmptyState
              icon={Layers}
              title="Graph is still forming"
              description="The planning agent has not created mission nodes yet. Seed the flagship demo or capture an intent to populate this graph."
            />
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={!!selectedNode}
        onClose={() => setSelectedNode(null)}
        title={selectedNode?.title || "Mission node"}
        subtitle={selectedNode ? `${prettyLabel(selectedNode.node_type)} · ${prettyLabel(selectedNode.status)}` : undefined}
        eyebrow="Dependency node"
        icon={<Layers className="h-4 w-4" strokeWidth={1.8} />}
        footer={
          <button
            type="button"
            onClick={() => setSelectedNode(null)}
            className={buttonClasses("secondary", "sm")}
          >
            Close
          </button>
        }
      >
        {selectedNode ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={
                  selectedNode.status === "COMPLETED"
                    ? "success"
                    : selectedNode.status === "BLOCKED"
                      ? "danger"
                      : selectedNode.status === "IN_PROGRESS"
                        ? "warning"
                        : "neutral"
                }
                dot
                label={prettyLabel(selectedNode.status)}
              />
              <Badge tone="neutral">{prettyLabel(selectedNode.node_type)}</Badge>
            </div>

            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                Progress
              </p>
              <ProgressBar
                value={clampPercent(selectedNode.progress)}
                tone={selectedNode.status === "BLOCKED" ? "danger" : "brand"}
                className="mt-2"
                label="Node progress"
              />
              <p className="mt-1.5 text-[12.5px] text-ink-secondary">
                {clampPercent(selectedNode.progress)}% complete
              </p>
            </div>

            {selectedNode.metadata_json && Object.keys(selectedNode.metadata_json).length > 0 ? (
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                  Metadata
                </p>
                <dl className="mt-2 space-y-1.5">
                  {Object.entries(selectedNode.metadata_json).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-3 rounded-lg border border-line-subtle bg-surface-muted px-3 py-2"
                    >
                      <dt className="text-[12.5px] text-ink-secondary">{prettyLabel(key)}</dt>
                      <dd className="text-right text-[12.5px] font-medium text-ink">
                        {typeof value === "string" || typeof value === "number" || typeof value === "boolean"
                          ? String(value)
                          : JSON.stringify(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <p className="text-[12.5px] text-ink-muted">
                No extra metadata on this node yet.
              </p>
            )}

            <p className="text-[12px] text-ink-muted">
              Node id: <span className="font-mono">{selectedNode.id}</span>
            </p>
          </div>
        ) : null}
      </Modal>

      <Card>
        <CardHeader
          title="Commitments"
          subtitle="Owened work that keeps this mission alive"
          icon={<CheckCircle2 className="h-4 w-4" />}
          action={
            <Link href="/commitments" className={buttonClasses("secondary", "sm")}>
              Open center
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <CardBody>
          {commitments.length === 0 ? (
            <EmptyState
              icon={CircleCheckBig}
              title="No commitments linked yet"
              description="Capture a commitment or parse an intent so this mission has protectable threads."
            />
          ) : (
            <div className="space-y-3">
              {commitments.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line-subtle bg-surface-muted p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={commitmentStatusTone(c.status)} dot label={prettyLabel(c.status)} />
                      <Badge tone={riskTone(c.risk_level)} size="sm">
                        {prettyLabel(c.risk_level)} risk
                      </Badge>
                    </div>
                    <p className="mt-2 text-[13.5px] font-semibold text-ink">{c.action}</p>
                    <p className="mt-1 text-[12px] text-ink-secondary">
                      {c.recipient ? `Owed to ${c.recipient}` : "Self"}
                      {c.deadline ? ` · due ${formatDateTime(c.deadline)}` : ""}
                    </p>
                  </div>
                  <Link href="/commitments" className={buttonClasses("ghost", "sm")}>
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
