"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Layers,
  Link2,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ActionPassport } from "@/lib/types";
import {
  continuityScore,
  daysUntil,
  dueInfo,
  formatDateTime,
  greeting,
  isClosed,
  sortByDeadline,
} from "@/lib/ui";
import { CommitmentCard } from "@/components/commitments/CommitmentCard";
import { ActionPassportModal } from "@/components/risks/ActionPassportModal";
import { Card, CardBody, CardHeader, SectionHeader } from "@/components/ui/Card";
import { Button, buttonClasses } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import { HeroSection } from "@/components/ui/HeroSection";
import { ContinuityLoop } from "@/components/ui/ContinuityLoop";
import { CommitmentGraph, type GraphSatellite } from "@/components/ui/CommitmentGraph";
import { AIAssistant } from "@/components/ui/AIAssistant";
import { UpcomingCommitments } from "@/components/ui/UpcomingCommitments";
import { BlindSpotCard, type BlindSpotItem } from "@/components/ui/BlindSpotCard";
import { ContinuityScoreCard } from "@/components/ui/ContinuityScore";
import { ActivityList, type ActivityItem } from "@/components/ui/ActivityList";
import { BottomCTA } from "@/components/ui/BottomCTA";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/Toast";

const ACTIVITY_ICONS = [Bot, ShieldAlert, CalendarCheck, Sparkles] as const;

export default function LifeSurfacePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedPassport, setSelectedPassport] = useState<ActionPassport | null>(null);
  const [isPassportOpen, setIsPassportOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: missions = [], isLoading: missionsLoading } = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.getMissions(),
  });

  const { data: commitments = [], isLoading: commitmentsLoading } = useQuery({
    queryKey: ["commitments"],
    queryFn: () => api.getCommitments("ALL"),
  });

  const { data: risks = [] } = useQuery({
    queryKey: ["risks"],
    queryFn: () => api.getRisks(),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["actions"],
    queryFn: () => api.getActions(),
  });

  const { data: blindSpots } = useQuery({
    queryKey: ["blindSpots"],
    queryFn: () => api.getBlindSpots(),
  });

  const { data: resolveDay } = useQuery({
    queryKey: ["resolveDay"],
    queryFn: () => api.getResolveDay(),
  });

  const { data: agentRuns = [] } = useQuery({
    queryKey: ["agentRuns"],
    queryFn: () => api.getAgentRuns(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      api.updateCommitment(id, { status: newStatus as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["blindSpots"] });
      toast({ title: "Loop closed", description: "The commitment thread is now closed." });
    },
    onError: () =>
      toast({
        title: "Could not update commitment",
        description: "The server rejected the change. Nothing was modified.",
        tone: "danger",
      }),
  });

  // ------------------------------------------------------------- derived data
  const openCommitments = commitments.filter((c) => !isClosed(c.status));
  const atRiskCommitments = openCommitments.filter(
    (c) => c.status === "AT_RISK" || c.risk_level === "HIGH" || c.risk_level === "CRITICAL"
  );
  const dueSoonCommitments = openCommitments.filter((c) => {
    const days = daysUntil(c.deadline);
    return days !== null && days <= 3;
  });
  const closedCount = commitments.length - openCommitments.length;
  const overallProgress = missions.length
    ? Math.round(
        missions.reduce((sum, mission) => sum + (mission.progress || 0), 0) / missions.length
      )
    : commitments.length
      ? Math.round((closedCount / commitments.length) * 100)
      : 0;

  const score = continuityScore(commitments);
  const orderedOpen = sortByDeadline(openCommitments);
  const nearest = orderedOpen[0];
  const nearestDue = dueInfo(nearest?.deadline, nearest?.status);

  const peopleCount = new Set(openCommitments.map((c) => c.recipient).filter(Boolean)).size;
  const dependencyCount = openCommitments.reduce(
    (sum, commitment) => sum + (commitment.dependencies?.length || 0),
    0
  );
  const activeHighRisks = risks.filter(
    (risk) => !risk.is_resolved && (risk.severity === "HIGH" || risk.severity === "CRITICAL")
  );
  const pendingPassport = actions.find((action) => action.status === "PENDING_APPROVAL");

  const blindSpotItems: BlindSpotItem[] = [
    ...(blindSpots?.waiting_on_user || []).map((item: any, index: number) => ({
      id: `waiting-${index}`,
      title: `${item.recipient ?? "Someone"} is waiting on you`,
      detail: item.action || item.reason,
      meta: "Waiting for your response",
    })),
    ...(blindSpots?.expiring_windows || []).map((item: any, index: number) => ({
      id: `window-${index}`,
      title: item.title || "Window closing",
      detail: item.warning,
      meta: item.time_left ? `Closes in ${item.time_left}` : undefined,
    })),
  ];

  const satellites: GraphSatellite[] = [
    {
      id: "deadline",
      label: "Deadline",
      detail: nearest ? nearestDue.label : "Nothing scheduled",
      icon: Clock,
      tone: nearest ? nearestDue.tone : "neutral",
    },
    {
      id: "people",
      label: "People",
      detail: peopleCount ? `${peopleCount} waiting on you` : "Nobody waiting",
      icon: Users,
      tone: peopleCount ? "warning" : "success",
    },
    {
      id: "dependencies",
      label: "Dependencies",
      detail: dependencyCount ? `${dependencyCount} tracked` : "None tracked",
      icon: Link2,
      tone: dependencyCount ? "info" : "neutral",
    },
    {
      id: "risk",
      label: "Blocking risk",
      detail: activeHighRisks.length ? `${activeHighRisks.length} active` : "None active",
      icon: ShieldAlert,
      tone: activeHighRisks.length ? "danger" : "success",
    },
    {
      id: "missions",
      label: "Missions",
      detail: `${missions.length} in flight`,
      icon: Target,
      tone: "brand",
    },
    {
      id: "blind-spots",
      label: "Blind spots",
      detail: `${blindSpots?.total_found ?? 0} found`,
      icon: Layers,
      tone: (blindSpots?.total_found ?? 0) > 0 ? "warning" : "success",
    },
  ];

  const activityItems: ActivityItem[] = agentRuns.slice(0, 8).map((run, index) => ({
    id: run.id,
    icon: ACTIVITY_ICONS[index % ACTIVITY_ICONS.length],
    title: run.task_description,
    source: `${run.agent_type} · ${run.model_used}`,
    timestamp: run.created_at,
    tone: run.status === "FAILED" ? "danger" : run.status === "COMPLETED" ? "success" : "brand",
  }));

  const heroQuote = pendingPassport
    ? {
        text: `An action is waiting for your approval: “${pendingPassport.action_name}”. CONVIA will not proceed without you.`,
        source: "Awaiting decision",
      }
    : atRiskCommitments.length
      ? {
          text: `${atRiskCommitments.length} commitment${atRiskCommitments.length === 1 ? "" : "s"} need attention. Recovery options are already prepared.`,
          source: "Continuity signal",
        }
      : dueSoonCommitments.length
        ? {
            text: `${dueSoonCommitments.length} commitment${dueSoonCommitments.length === 1 ? "" : "s"} come due within three days. The next step is already mapped.`,
            source: "Continuity signal",
          }
        : {
            text: "Everything important is protected. CONVIA keeps watching so nothing slips.",
            source: "Continuity signal",
          };

  const userName = user?.full_name ?? "Continuity user";

  const askAssistant = async (prompt: string): Promise<{ text: string; provider?: string }> => {
    const result = await api.respondToVoice(prompt);
    return { text: result.text_response, provider: result.provider_used };
  };

  const captureAssistant = async (prompt: string): Promise<string> => {
    const result: any = await api.parseIntent(prompt, "text");
    queryClient.invalidateQueries({ queryKey: ["commitments"] });
    queryClient.invalidateQueries({ queryKey: ["missions"] });
    queryClient.invalidateQueries({ queryKey: ["blindSpots"] });
    queryClient.invalidateQueries({ queryKey: ["agentRuns"] });
    queryClient.invalidateQueries({ queryKey: ["people"] });
    queryClient.invalidateQueries({ queryKey: ["waiting"] });
    return (
      result?.summary_message ??
      "CONVIA captured your intent and updated the continuity surface."
    );
  };

  return (
    <div className="space-y-7 animate-fade-in">
      {/* 1. Hero — brand gradient, command search, dynamic greeting */}
      <HeroSection
        greeting={greeting()}
        name={userName}
        description="Your commitments. Your context. Your next steps. CONVIA keeps the thread of your life intact."
        quote={heroQuote}
        onOpenCommand={() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
        }}
        meta={user?.autonomy_level ? `Autonomy L${user.autonomy_level}` : undefined}
        status={
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11.5px] font-medium text-white/85 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-light animate-pulse-soft" />
            {openCommitments.length} open loop{openCommitments.length === 1 ? "" : "s"}
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              className="border-transparent bg-white text-brand-deep hover:border-transparent hover:bg-white/90"
              onClick={() =>
                document.getElementById("resolve-day")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              <CalendarCheck className="h-4 w-4" strokeWidth={1.9} />
              Resolve my day
            </Button>
            <Link
              href="/commitments"
              className={buttonClasses(
                "ghost",
                "md",
                "border border-white/20 text-white hover:bg-white/10 hover:text-white"
              )}
            >
              Review commitments
              <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
            </Link>
          </>
        }
      />

      {/* 2. Pending action passport */}
      {pendingPassport ? (
        <div className="flex flex-col gap-4 rounded-xl border border-[#F7E2B8] bg-warning-light p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/70 bg-white/70 text-[#B87A0E]">
              <ShieldAlert className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning" dot>
                  Action passport awaiting approval
                </Badge>
                <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#B87A0E]">
                  <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                  Budget risk mitigation
                </span>
              </div>
              <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight text-ink">
                {pendingPassport.action_name}
              </h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-secondary">
                {pendingPassport.why}
              </p>
            </div>
          </div>

          <Button
            className="shrink-0"
            onClick={() => {
              setSelectedPassport(pendingPassport);
              setIsPassportOpen(true);
            }}
          >
            Review action passport
            <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
          </Button>
        </div>
      ) : null}

      {/* 3. Metric row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active commitments"
          value={openCommitments.length}
          icon={CheckCircle2}
          tone="brand"
          trend={`${closedCount} closed`}
          trendDirection="up"
          hint="Open threads CONVIA is tracking"
        />
        <StatCard
          label="Due soon"
          value={dueSoonCommitments.length}
          icon={Clock}
          tone={dueSoonCommitments.length ? "warning" : "success"}
          trend="next 3 days"
          trendDirection="flat"
          hint="Deadlines approaching fastest"
        />
        <StatCard
          label="Overall progress"
          value={`${overallProgress}%`}
          icon={Target}
          tone="info"
          trend={`${missions.length} mission${missions.length === 1 ? "" : "s"}`}
          trendDirection="up"
          hint="Average mission completion"
        />
        <StatCard
          label="At risk"
          value={atRiskCommitments.length}
          icon={ShieldAlert}
          tone={atRiskCommitments.length ? "danger" : "success"}
          trend={`${activeHighRisks.length} risk signal${activeHighRisks.length === 1 ? "" : "s"}`}
          trendDirection={atRiskCommitments.length ? "up" : "flat"}
          trendPositive={false}
          hint="Needs a decision from you"
        />
      </div>

      {/* 4. Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_356px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              icon={<Sparkles className="h-4 w-4" strokeWidth={1.8} />}
              title="The continuity loop"
              subtitle="How CONVIA keeps every commitment moving without dropping the thread"
            />
            <CardBody>
              <ContinuityLoop />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={<Link2 className="h-4 w-4" strokeWidth={1.8} />}
              title="Commitment graph"
              subtitle="How your nearest commitment connects to people, dependencies and risk"
              action={
                <span className="hidden text-[12px] text-ink-muted sm:inline">
                  {satellites.length} relationships
                </span>
              }
            />
            <CardBody>
              <CommitmentGraph
                center={{
                  title: nearest?.action ?? missions[0]?.title ?? "No active commitment",
                  subtitle:
                    nearest?.context ??
                    nearest?.recipient ??
                    missions[0]?.desired_outcome ??
                    "CONVIA has nothing open right now.",
                  meta: nearest ? nearestDue.label : "All loops closed",
                }}
                satellites={satellites}
              />
            </CardBody>
          </Card>

          <AIAssistant
            onAsk={askAssistant}
            onCapture={captureAssistant}
            suggestions={[
              "Break down my internship relocation plan",
              "Summarize my pending commitments",
              "What are my blind spots right now?",
              "Create an action plan for the next 2 weeks",
              "Find flights under ₹10,000 to Bangalore",
            ]}
          />

          {/* Missions in flight */}
          <Card>
            <CardHeader
              icon={<Target className="h-4 w-4" strokeWidth={1.8} />}
              title="Missions in flight"
              subtitle="Life outcomes currently being protected"
              action={
                <Link
                  href="/missions"
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand transition-colors hover:text-brand-deep"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                </Link>
              }
            />
            <CardBody>
              {missionsLoading ? (
                <LoadingState label="Loading missions" rows={2} />
              ) : missions.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="No active missions"
                  description="Tell CONVIA what you want to accomplish, or load the flagship relocation demo."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => api.seedFlagshipDemo().then(() => window.location.reload())}
                    >
                      Load flagship demo
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-2.5">
                  {missions.slice(0, 4).map((mission) => (
                    <li key={mission.id}>
                      <Link
                        href={`/missions/${mission.id}`}
                        className="block rounded-xl border border-line-subtle bg-surface-muted p-3.5 transition-colors duration-150 ease-out hover:border-line hover:bg-surface"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-[13.5px] font-medium text-ink">
                            {mission.title}
                          </span>
                          <span className="shrink-0 text-[12px] font-semibold text-brand-mid">
                            {Math.round(mission.progress)}%
                          </span>
                        </div>
                        <ProgressBar
                          value={mission.progress}
                          tone={mission.status === "AT_RISK" ? "danger" : "success"}
                          className="mt-2.5"
                          label={`${mission.title} progress`}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Active obligations */}
          <section className="space-y-4">
            <SectionHeader
              eyebrow="Commitments"
              title="Active obligations"
              description="Obligations with context, recipients, consequences and recovery paths."
              action={
                <Link href="/commitments" className={buttonClasses("outline", "sm")}>
                  View all ({commitments.length})
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                </Link>
              }
            />

            {commitmentsLoading ? (
              <LoadingState label="Loading commitments" rows={2} />
            ) : commitments.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No commitments captured yet"
                description="Speak or type what you owe someone, and CONVIA will track it end to end."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => api.seedFlagshipDemo().then(() => window.location.reload())}
                  >
                    Load flagship demo
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {orderedOpen
                  .concat(commitments.filter((c) => isClosed(c.status)))
                  .slice(0, 6)
                  .map((commitment) => (
                    <CommitmentCard
                      key={commitment.id}
                      commitment={commitment}
                      onStatusChange={(id, newStatus) => statusMutation.mutate({ id, newStatus })}
                      onInspectRisk={(commitment) => {
                        const relatedRisk = risks.find(
                          (r) => r.commitment_id === commitment.id && !r.is_resolved
                        );
                        if (relatedRisk?.recovery_strategies.length) {
                          router.push("/risks");
                          return;
                        }
                        const relatedPassport =
                          actions.find(
                            (a) =>
                              a.commitment_id === commitment.id &&
                              a.status === "PENDING_APPROVAL"
                          ) ||
                          actions.find((a) => a.commitment_id === commitment.id) ||
                          pendingPassport;
                        if (relatedPassport) {
                          setSelectedPassport(relatedPassport);
                          setIsPassportOpen(true);
                        } else {
                          toast({
                            title: "No recovery path yet",
                            description:
                              "CONVIA has not prepared a passport for this commitment.",
                            tone: "danger",
                          });
                        }
                      }}
                    />
                  ))}
              </div>
            )}
          </section>

          {/* Resolve my day */}
          <section id="resolve-day" className="scroll-mt-24">
            <Card>
              <CardHeader
                icon={<CalendarCheck className="h-4 w-4" strokeWidth={1.8} />}
                title="Resolve my day"
                subtitle="An action sequence ordered to protect the commitments that matter most"
                action={
                  <Badge tone="info" dot>
                    {resolveDay?.critical_commitments_protected ?? 0} protected
                  </Badge>
                }
              />
              <CardBody>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{resolveDay?.total_hours_required ?? 0}h required</Badge>
                  {resolveDay?.plan_date ? (
                    <Badge tone="brand" dot>
                      Plan for {formatDateTime(resolveDay.plan_date)}
                    </Badge>
                  ) : null}
                </div>

                {resolveDay?.schedule?.length ? (
                  <ul className="space-y-2.5">
                    {resolveDay.schedule.map((item: any, index: number) => (
                      <li
                        key={`${item.time_slot}-${index}`}
                        className="flex flex-col gap-3 rounded-xl border border-line-subtle bg-surface-muted p-3.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 rounded-md border border-brand-light bg-brand-pale px-2 py-1 text-[11.5px] font-semibold text-brand-mid">
                            {item.time_slot}
                          </span>
                          <div>
                            <p className="text-[13.5px] font-medium text-ink">{item.title}</p>
                            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
                              {item.why}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Badge tone="neutral">{item.estimated_minutes} min</Badge>
                          <Badge tone={item.priority === "HIGH" ? "danger" : "info"}>
                            {item.priority}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={CalendarCheck}
                    title="Nothing to sequence yet"
                    description="Once commitments carry deadlines, CONVIA optimises the order of your day."
                  />
                )}

                {resolveDay?.tradeoffs_made?.length ? (
                  <div className="mt-4 rounded-[10px] border border-line-subtle bg-surface-sunken p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                      Trade-offs made
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {resolveDay.tradeoffs_made.map((tradeoff: string, index: number) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-secondary"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" />
                          {tradeoff}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </section>



        </div>

        <div className="space-y-6">
          <ContinuityScoreCard score={score} />

          <UpcomingCommitments
            commitments={openCommitments}
            href="/commitments"
            hrefLabel="All commitments"
            limit={5}
          />

          <div id="blind-spots" className="scroll-mt-24">
            <BlindSpotCard
              total={blindSpots?.total_found ?? 0}
              items={blindSpotItems}
              footer={
                blindSpotItems.length ? (
                  <Button
                    variant="warning"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      document
                        .getElementById("resolve-day")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Plan around these today
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </Button>
                ) : undefined
              }
            />
          </div>

          <ActivityList items={activityItems} />

          <Card>
            <CardHeader
              icon={<AlertTriangle className="h-4 w-4" strokeWidth={1.8} />}
              title="Needs attention"
              subtitle="Signals that need you, not the machine"
            />
            <CardBody className="space-y-2.5">
              <div className="flex items-center justify-between rounded-[10px] border border-[#F8D4D4] bg-danger-light px-3.5 py-2.5">
                <span className="text-[12.5px] font-medium text-ink">Commitments at risk</span>
                <span className="text-[15px] font-semibold text-danger">
                  {atRiskCommitments.length}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[10px] border border-[#F7E2B8] bg-warning-light px-3.5 py-2.5">
                <span className="text-[12.5px] font-medium text-ink">People waiting on you</span>
                <span className="text-[15px] font-semibold text-[#B87A0E]">{peopleCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-[10px] border border-line bg-surface-sunken px-3.5 py-2.5">
                <span className="text-[12.5px] font-medium text-ink">Dependencies monitored</span>
                <span className="text-[15px] font-semibold text-ink-secondary">
                  {dependencyCount}
                </span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={<Sparkles className="h-4 w-4" strokeWidth={1.8} />}
              title="Life signals"
              subtitle="State of the continuity engine"
            />
            <CardBody className="space-y-2.5">
              <div className="flex items-center justify-between rounded-[10px] border border-brand-light bg-brand-pale px-3.5 py-2.5">
                <span className="text-[12.5px] font-medium text-ink">Loops closed</span>
                <span className="text-[15px] font-semibold text-brand-mid">{closedCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-[10px] border border-line bg-surface-sunken px-3.5 py-2.5">
                <span className="text-[12.5px] font-medium text-ink">Autonomy level</span>
                <span className="text-[13px] font-semibold text-ink-secondary">
                  L{user?.autonomy_level ?? 3} · Ask before acting
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[10px] border border-line bg-surface-sunken px-3.5 py-2.5">
                <span className="text-[12.5px] font-medium text-ink">Continuity checks</span>
                <span className="text-[13px] font-semibold text-ink-secondary">
                  {activityItems.length} recent runs
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <BottomCTA
        title="Keep moving forward."
        description="CONVIA helps you see what's at risk and close important loops before they slip."
        actionLabel="Explore missions"
        href="/missions"
        icon={<Sparkles className="h-5 w-5" strokeWidth={1.8} />}
      />

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

