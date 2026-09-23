"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Gauge, Layers, Plus, Target, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { clampPercent, prettyLabel, riskTone } from "@/lib/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/Toast";

export default function MissionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [outcome, setOutcome] = useState("");
  const [budget, setBudget] = useState("");

  const { data: missions = [], isLoading } = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.getMissions(),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const budgetLimit = budget.trim() === "" ? null : parseFloat(budget);
      return api.createMission({
        title,
        desired_outcome: outcome || undefined,
        budget_limit: budgetLimit && Number.isFinite(budgetLimit) ? budgetLimit : null,
        priority: "HIGH",
        status: "ACTIVE",
      } as Partial<any>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      toast({
        title: "Mission created",
        description: "CONVIA will start decomposing it into commitments.",
      });
      setShowCreateModal(false);
      setTitle("");
      setOutcome("");
      setBudget("");
    },
    onError: () => toast({ title: "Could not create mission", tone: "danger" }),
  });

  const activeMissions = missions.filter((mission) => mission.status === "ACTIVE");
  const atRiskMissions = missions.filter((mission) => mission.status === "AT_RISK");
  const averageProgress = missions.length
    ? Math.round(
        missions.reduce((sum, mission) => sum + (mission.progress || 0), 0) / missions.length
      )
    : 0;
  const totalBudget = missions.reduce((sum, mission) => sum + (mission.budget_limit || 0), 0);

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Outcomes & life goals"
        title="Missions"
        description="A mission is a meaningful life outcome translated into a structured graph of objectives, commitments and dependencies."
        icon={<Target className="h-5 w-5" strokeWidth={1.75} />}
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.9} />
            New mission
          </Button>
        }
        meta={
          <>
            <Badge tone="brand" dot>
              {missions.length} total
            </Badge>
            <Badge tone="neutral">{activeMissions.length} active</Badge>
            {atRiskMissions.length ? (
              <Badge tone="danger" dot>
                {atRiskMissions.length} at risk
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active missions"
          value={activeMissions.length}
          icon={Target}
          tone="brand"
          hint="Currently being protected"
        />
        <StatCard
          label="Average progress"
          value={`${averageProgress}%`}
          icon={Gauge}
          tone="info"
          hint="Across every mission"
        />
        <StatCard
          label="Committed budget"
          value={totalBudget ? formatCurrency(totalBudget) : "—"}
          icon={Wallet}
          tone="success"
          hint="Sum of mission budget limits"
        />
        <StatCard
          label="At risk"
          value={atRiskMissions.length}
          icon={Layers}
          tone={atRiskMissions.length ? "danger" : "success"}
          trendPositive={false}
          hint="Flagged by the risk engine"
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading missions" rows={3} />
      ) : missions.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No missions yet"
          description="Tell CONVIA what you want to accomplish, or load the flagship Bangalore relocation scenario."
          action={
            <>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" strokeWidth={1.9} />
                New mission
              </Button>
              <Button
                variant="secondary"
                onClick={() => api.seedFlagshipDemo().then(() => window.location.reload())}
              >
                Load flagship demo
              </Button>
            </>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {missions.map((mission) => {
            const progress = clampPercent(mission.progress);
            const isAtRisk = mission.status === "AT_RISK";

            return (
              <Card key={mission.id} interactive className="flex flex-col p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge
                    tone={isAtRisk ? "danger" : mission.status === "ACTIVE" ? "brand" : "neutral"}
                    dot
                  >
                    {prettyLabel(mission.status)}
                  </Badge>
                  <span className="text-[12px] font-semibold text-brand-mid">
                    {progress}% complete
                  </span>
                </div>

                <h2 className="mt-3 text-[17px] font-semibold leading-snug tracking-tight text-ink">
                  {mission.title}
                </h2>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-secondary">
                  {mission.desired_outcome || mission.description || "No outcome described yet."}
                </p>

                <ProgressBar
                  value={progress}
                  tone={riskTone(isAtRisk ? "HIGH" : "LOW")}
                  className="mt-4"
                  label={`${mission.title} progress`}
                />

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-subtle pt-4 text-[12.5px] text-ink-secondary">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.8} />
                    {mission.nodes?.length || 0} nodes
                  </span>
                  {mission.target_date ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.8} />
                      {formatDate(mission.target_date)}
                    </span>
                  ) : null}
                  {mission.budget_limit ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.8} />
                      Budget {formatCurrency(mission.budget_limit, mission.budget_currency)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4">
                  <Link
                    href={`/missions/${mission.id}`}
                    className={buttonClasses("secondary", "sm")}
                  >
                    Open mission control
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardBody>
          <p className="text-[12.5px] leading-relaxed text-ink-secondary">
            Missions are decomposed by the planning agent into objectives, tasks and external
            dependencies. Every node tracks its own progress, and blocking edges are surfaced as
            risks before they become failures.
          </p>
        </CardBody>
      </Card>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New mission"
        subtitle="Define the outcome; CONVIA will decompose it into commitments"
        eyebrow="Life outcome"
        icon={<Target className="h-4 w-4" strokeWidth={1.8} />}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!title.trim()}
              loading={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create mission"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Mission title" htmlFor="mission-title">
            <Input
              id="mission-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Move to Bangalore"
            />
          </Field>
          <Field
            label="Desired outcome"
            htmlFor="mission-outcome"
            hint="What does done look like?"
          >
            <Textarea
              id="mission-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={3}
              placeholder="e.g. Relocated, settled in HSR, shipping Phoenix from the new office"
            />
          </Field>
          <Field label="Budget ceiling (INR)" htmlFor="mission-budget" hint="Optional. Leave blank for no budget cap.">
            <Input
              id="mission-budget"
              type="number"
              min={0}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 80000"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
