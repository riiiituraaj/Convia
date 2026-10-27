"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Globe2,
  Library,
  MessageSquareText,
  Plane,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { ActionPassportModal } from "@/components/risks/ActionPassportModal";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { api } from "@/lib/api";
import type { ActionPassport } from "@/lib/types";
import { daysUntil, isClosed, sortByDeadline } from "@/lib/ui";

function displayDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function agentStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default function LifeSurfacePage() {
  const queryClient = useQueryClient();
  const [selectedPassport, setSelectedPassport] = useState<ActionPassport | null>(null);
  const [isPassportOpen, setIsPassportOpen] = useState(false);

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => api.getMe(), staleTime: 5 * 60 * 1000, retry: false });
  const { data: missions = [], isLoading: missionsLoading, isError: missionsError } = useQuery({ queryKey: ["missions"], queryFn: () => api.getMissions() });
  const { data: commitments = [], isLoading: commitmentsLoading, isError: commitmentsError } = useQuery({ queryKey: ["commitments"], queryFn: () => api.getCommitments("ALL") });
  const { data: risks = [], isLoading: risksLoading, isError: risksError } = useQuery({ queryKey: ["risks"], queryFn: () => api.getRisks() });
  const { data: actions = [], isLoading: actionsLoading } = useQuery({ queryKey: ["actions"], queryFn: () => api.getActions() });
  const { data: dayPlan, isLoading: dayPlanLoading, isError: dayPlanError } = useQuery({ queryKey: ["resolveDay"], queryFn: () => api.getResolveDay() });
  const { data: agentRuns = [], isLoading: agentRunsLoading, isError: agentRunsError } = useQuery({ queryKey: ["agentRuns"], queryFn: () => api.getAgentRuns() });
  const { data: documents = [], isLoading: documentsLoading, isError: documentsError } = useQuery({ queryKey: ["documents", ""], queryFn: () => api.getDocuments() });
  const { data: researchSessions = [], isLoading: researchLoading, isError: researchError } = useQuery({ queryKey: ["research"], queryFn: () => api.getResearchSessions() });
  const { data: conversations = [], isLoading: conversationsLoading, isError: conversationsError } = useQuery({ queryKey: ["conversations"], queryFn: () => api.getConversations() });
  const { data: memories = [], isLoading: memoriesLoading, isError: memoriesError } = useQuery({ queryKey: ["memory"], queryFn: () => api.getMemories() });
  const { data: artifacts = [], isLoading: artifactsLoading, isError: artifactsError } = useQuery({ queryKey: ["artifacts"], queryFn: () => api.getArtifacts() });

  const openCommitments = useMemo(() => commitments.filter((item) => !isClosed(item.status)), [commitments]);
  const orderedOpen = useMemo(() => sortByDeadline(openCommitments), [openCommitments]);
  const dueSoon = openCommitments.filter((item) => {
    const days = daysUntil(item.deadline);
    return days !== null && days >= 0 && days <= 3;
  });
  const atRisk = openCommitments.filter((item) => item.status === "AT_RISK" || item.risk_level === "HIGH" || item.risk_level === "CRITICAL");
  const highRisks = risks.filter((risk) => !risk.is_resolved && (risk.severity === "HIGH" || risk.severity === "CRITICAL"));
  const pendingPassport = actionsLoading ? undefined : actions.find((action) => action.status === "PENDING_APPROVAL");

  const recentWork = useMemo(() => [
    ...conversations.map((item) => ({
      id: `conversation-${item.id}`, title: item.title || "Conversation", description: item.last_message_preview || `${item.message_count} saved messages`, date: item.updated_at, href: `/conversations#${item.id}`, icon: MessageSquareText, kind: "Conversation",
    })),
    ...missions.map((item) => ({
      id: `mission-${item.id}`, title: item.title, description: item.desired_outcome || item.description || "Saved project mission", date: item.updated_at, href: `/missions/${item.id}`, icon: FolderKanban, kind: "Project",
    })),
    ...documents.map((item) => ({
      id: `document-${item.id}`, title: item.filename, description: item.summary_text || `${item.extension.toUpperCase()} · ${Math.max(1, Math.round(item.size_bytes / 1024))} KB`, date: item.updated_at, href: `/documents#${item.id}`, icon: FileText, kind: "Document",
    })),
    ...artifacts.map((item) => ({
      id: `artifact-${item.id}`, title: item.title, description: item.summary || item.artifact_type.replaceAll("_", " "), date: item.updated_at, href: `/library#${item.id}`, icon: Library, kind: "Saved work",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5), [artifacts, conversations, documents, missions]);

  const firstName = user?.full_name?.trim().split(/\s+/)[0];
  const today = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const recentLoading = conversationsLoading || documentsLoading || artifactsLoading || missionsLoading;
  const recentError = conversationsError || documentsError || artifactsError || missionsError;
  const currentOpenCount = commitmentsLoading ? "Loading" : commitmentsError ? "Unavailable" : openCommitments.length;
  const retryRecentWork = () => {
    ["conversations", "documents", "artifacts", "missions"].forEach((key) => {
      void queryClient.invalidateQueries({ queryKey: [key] });
    });
  };

  const dashboardMetrics = [
    { label: "Open commitments", value: openCommitments.length, loading: commitmentsLoading, note: commitmentsLoading ? "Loading" : commitmentsError ? "Unavailable" : `${commitments.length} saved total`, icon: CheckCircle2, tint: "bg-[#eaf1ec] text-[#658b77]" },
    { label: "Due in 3 days", value: dueSoon.length, loading: commitmentsLoading, note: commitmentsLoading ? "Loading" : commitmentsError ? "Unavailable" : "Saved deadlines", icon: Clock3, tint: "bg-[#f3eee3] text-[#a28b5d]" },
    { label: "Projects", value: missions.length, loading: missionsLoading, note: missionsLoading ? "Loading" : missionsError ? "Unavailable" : "Saved missions", icon: Target, tint: "bg-[#e8edf8] text-[#637cae]" },
    { label: "At risk", value: atRisk.length, loading: commitmentsLoading, note: commitmentsLoading ? "Loading" : commitmentsError ? "Commitments unavailable" : risksLoading ? "Loading risk signals" : risksError ? "Risk signals unavailable" : `${highRisks.length} high risk signals`, icon: ShieldAlert, tint: "bg-[#f6eaea] text-[#a87575]" },
  ];

  const workspaces = [
    { title: "Projects", subtitle: "Missions and outcomes", count: missionsLoading ? "Loading" : missionsError ? "Unavailable" : `${missions.length} saved`, href: "/missions", icon: FolderKanban, tint: "bg-[#e8edf8] text-[#637cae]" },
    { title: "Documents", subtitle: "Files and summaries", count: documentsLoading ? "Loading" : documentsError ? "Unavailable" : `${documents.length} saved`, href: "/documents", icon: FileText, tint: "bg-[#eaf1ec] text-[#658b77]" },
    { title: "Research", subtitle: "Search and source notes", count: researchLoading ? "Loading" : researchError ? "Unavailable" : `${researchSessions.length} saved`, href: "/search", icon: Globe2, tint: "bg-[#f2eee5] text-[#a28b5d]" },
    { title: "Knowledge", subtitle: "Your saved context", count: memoriesLoading ? "Loading" : memoriesError ? "Unavailable" : `${memories.length} notes`, href: "/memory", icon: BookOpen, tint: "bg-[#efebf4] text-[#8679a5]" },
  ];

  const shortcuts = [
    { title: "Summarize a PDF", href: "/documents", icon: FileText, tint: "bg-[#e8edf8] text-[#637cae]" },
    { title: "Plan a trip", href: "/travel", icon: Plane, tint: "bg-[#eaf1ec] text-[#658b77]" },
    { title: "Research a topic", href: "/search", icon: Search, tint: "bg-[#f2eee5] text-[#a28b5d]" },
    { title: "Create a draft", href: "/studio", icon: Plus, tint: "bg-[#efebf4] text-[#8679a5]" },
  ];

  return (
    <div className="dashboard-layout animate-fade-in">
      <div className="dashboard-main space-y-4">
        <section className="workspace-hero" aria-labelledby="workspace-title">
          <Image src="/convia-alpine.webp" alt="Morning mist over an alpine lake and distant mountains" fill priority unoptimized sizes="(max-width: 900px) 100vw, 72vw" className="workspace-hero-image" />
          <div className="workspace-hero-copy">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-secondary">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} /> CONVIA · Your workspace
            </div>
            <p className="mt-4 text-[13px] font-medium text-ink-secondary">{today}{firstName ? ` · Welcome back, ${firstName}` : ""}</p>
            <h1 id="workspace-title" className="mt-2 max-w-[540px] text-[clamp(32px,3.4vw,46px)] font-semibold leading-[1.08] tracking-[-0.04em] text-ink">
              Your world, intelligently connected.
            </h1>
            <p className="mt-3 max-w-[460px] text-[14px] leading-[1.65] text-ink-secondary sm:text-[15px]">
              Keep your conversations, projects, commitments, and knowledge in one calm place.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link href="#workspaces" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep focus-visible:outline-offset-2">
                Explore workspaces <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/conversations" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[14px] font-semibold text-ink-secondary transition-colors hover:bg-surface-muted">
                <MessageSquareText className="h-3.5 w-3.5" /> Ask CONVIA
              </Link>
            </div>
          </div>
          <div className="intelligence-sphere" aria-hidden="true" />
          <div className="absolute bottom-4 right-4 z-[2] hidden rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-secondary sm:block">
            {commitmentsError ? "Commitments unavailable" : commitmentsLoading ? "Loading commitments" : `${currentOpenCount} open commitments`}
          </div>
        </section>

        {pendingPassport ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-[#ead8b9] bg-[rgba(255,250,239,0.88)] p-4 shadow-[0_5px_16px_rgba(96,74,32,0.05)] sm:flex-row sm:items-center sm:justify-between" aria-label="Action awaiting your decision">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f8eedb] text-warning"><ShieldAlert className="h-[17px] w-[17px]" /></span>
              <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-warning">Awaiting your decision</p><p className="mt-0.5 truncate text-[13px] font-semibold text-ink">{pendingPassport.action_name}</p><p className="mt-0.5 line-clamp-1 text-[12px] text-ink-secondary">Approval records your choice; it does not run an external action.</p></div>
            </div>
            <button type="button" onClick={() => { setSelectedPassport(pendingPassport); setIsPassportOpen(true); }} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[#e1cca5] bg-surface px-4 text-[13px] font-semibold text-[#765a31] transition hover:bg-surface-muted">Review proposal <ArrowRight className="h-3.5 w-3.5" /></button>
          </section>
        ) : null}

        <section className="dashboard-metrics" aria-label="Workspace overview">
          {dashboardMetrics.map((stat) => {
            const Icon = stat.icon;
            const unavailable = stat.label === "Projects" ? missionsError : commitmentsError;
            return <div key={stat.label} aria-busy={stat.loading} className="glass-panel flex min-h-[92px] min-w-0 items-center gap-3 rounded-2xl px-3.5 py-3 sm:px-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.tint}`}><Icon className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
              <div className="min-w-0"><p className="text-[12px] font-medium text-ink-secondary">{stat.label}</p><div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1"><span className="text-[24px] font-semibold leading-none tracking-tight text-ink">{stat.loading ? <span className="inline-block h-5 w-9 animate-pulse rounded-md bg-surface-sunken" role="status" aria-label={`Loading ${stat.label.toLowerCase()}`} /> : unavailable ? "—" : stat.value}</span><span className="text-[11px] text-ink-muted">{stat.note}</span></div></div>
            </div>;
          })}
        </section>

        <section id="workspaces" className="scroll-mt-24 space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Your workspaces</p><h2 className="mt-1 text-[20px] font-semibold tracking-tight text-ink">Everything in its place</h2></div>
            <Link href="/library" className="inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-deep focus-visible:outline-offset-2">Open library <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {workspaces.map((workspace) => {
              const Icon = workspace.icon;
              return <Link key={workspace.title} href={workspace.href} className="glass-panel group flex min-h-[120px] items-start gap-3 rounded-2xl p-4 transition duration-150 hover:-translate-y-px hover:bg-surface-muted hover:shadow-card-hover focus-visible:outline-offset-2">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] ${workspace.tint}`}><Icon className="h-[19px] w-[19px]" strokeWidth={1.8} /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-[15px] font-semibold text-ink">{workspace.title}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-brand group-focus-visible:text-brand" /></span><span className="mt-1 block truncate text-[13px] text-ink-secondary">{workspace.subtitle}</span><span className="mt-2 block text-[12px] font-medium text-ink-muted">{workspace.count}</span></span>
              </Link>;
            })}
          </div>
        </section>

        <section aria-label="Suggested starting points" className="flex flex-wrap items-center gap-2 px-1 py-0.5">
          <span className="mr-1 text-[12px] font-medium text-ink-muted">Start with</span>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("convia:fill-task", { detail: "I need to remember to " }))} className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-ink-secondary transition hover:bg-surface-muted">Capture a commitment</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("convia:fill-task", { detail: "I want to plan " }))} className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-ink-secondary transition hover:bg-surface-muted">Plan a project</button>
          <Link href="/documents" className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-ink-secondary transition hover:bg-surface-muted">Summarize a PDF</Link>
          <Link href="/search" className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-ink-secondary transition hover:bg-surface-muted">Research a topic</Link>
        </section>

        <Card className="!rounded-2xl">
          <CardHeader title="Recent work" subtitle="Pick up where you left off" icon={<Activity className="h-4 w-4" strokeWidth={1.8} />} action={<Link href="/activity" className="inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-deep">View activity <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          <CardBody className="pt-2">
            {recentLoading && recentWork.length === 0 ? <LoadingState rows={2} label="Loading recent work" className="py-2" /> : recentWork.length ? <>
              {recentError ? <div role="status" className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-muted px-3 py-2 text-[12px] text-ink-secondary"><span>Some saved work areas could not load.</span><button type="button" onClick={retryRecentWork} className="font-semibold text-brand hover:text-brand-deep">Retry</button></div> : null}
              <ul className="divide-y divide-line-subtle">
              {recentWork.map((item) => {
                const Icon = item.icon;
                return <li key={item.id}><Link href={item.href} className="group flex min-h-[64px] items-center gap-3 py-2.5 focus-visible:outline-offset-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-brand"><Icon className="h-[17px] w-[17px]" strokeWidth={1.8} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-ink group-hover:text-brand">{item.title}</span><span className="mt-0.5 block truncate text-[12px] text-ink-muted">{item.description}</span></span>
                  <span className="hidden shrink-0 text-[11px] text-ink-muted sm:block">{item.kind} · {displayDate(item.date)}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-brand group-focus-visible:text-brand" />
                </Link></li>;
              })}
              </ul>
            </> : recentError ? <EmptyState icon={Activity} title="Recent work couldn’t load" description="Your saved items are still safe. Retry when your connection is available." action={<button type="button" onClick={retryRecentWork} className="min-h-10 rounded-full border border-line bg-surface px-4 text-[13px] font-medium text-ink-secondary hover:bg-surface-muted">Try again</button>} /> : <EmptyState icon={Library} title="Your recent work will appear here" description="Start a conversation, add a document, or create a project. Saved items will be easy to reopen from this space." />}
          </CardBody>
        </Card>

        {orderedOpen.length ? <Card className="!rounded-2xl">
          <CardHeader title="Commitments to keep in view" subtitle="Your nearest saved deadlines" icon={<CalendarDays className="h-4 w-4" strokeWidth={1.8} />} action={<Link href="/commitments" className="inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-brand">All commitments <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          <CardBody className="pt-2"><ul className="divide-y divide-line-subtle">{orderedOpen.slice(0, 3).map((item) => <li key={item.id} className="flex min-h-[56px] items-center justify-between gap-3 py-2.5"><span className="min-w-0"><span className="block truncate text-[13px] font-medium text-ink">{item.action}</span><span className="mt-0.5 block truncate text-[12px] text-ink-muted">{item.recipient ? `With ${item.recipient}` : "No recipient saved"}</span></span><span className="shrink-0 text-[12px] text-ink-secondary">{displayDate(item.deadline) || "No deadline"}</span></li>)}</ul></CardBody>
        </Card> : null}
      </div>

      <aside className="dashboard-rail" aria-label="Daily plan and shortcuts">
        <Card id="resolve-day" className="!rounded-2xl">
          <CardHeader title="Today’s plan" subtitle={today} icon={<CalendarDays className="h-4 w-4" strokeWidth={1.8} />} action={<Link href="/commitments" aria-label="View saved commitments" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-sunken hover:text-brand"><ArrowRight className="h-4 w-4" /></Link>} />
          <CardBody>
            {dayPlanLoading ? <p role="status" className="py-1 text-[12px] text-ink-secondary">Loading saved deadlines…</p> : dayPlanError ? <div role="alert" className="space-y-2"><p className="py-1 text-[13px] leading-relaxed text-ink-secondary">Could not load your saved deadlines.</p><button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["resolveDay"] })} className="min-h-9 rounded-lg border border-line px-3 text-[12px] font-semibold text-brand hover:bg-surface-muted">Retry</button></div> : dayPlan?.schedule?.length ? <ul className="space-y-3">
              {dayPlan.schedule.slice(0, 4).map((item, index) => <li key={`${item.commitment_id ?? item.title}-${index}`} className="flex gap-3">
                <span className="relative flex w-12 shrink-0 flex-col items-center"><span className="rounded-md bg-surface-sunken px-1.5 py-1 text-[11px] font-semibold text-ink-secondary">{item.time_slot}</span>{index < Math.min(dayPlan.schedule.length, 4) - 1 ? <span className="absolute top-7 bottom-[-10px] w-px bg-line" /> : null}</span>
                <span className="min-w-0 pb-1"><span className="block line-clamp-2 text-[13px] font-medium leading-[1.45] text-ink">{item.title}</span><span className="mt-1 block text-[11px] text-ink-muted">Saved deadline · {item.priority.toLowerCase()} priority</span></span>
              </li>)}
            </ul> : <div className="py-1"><p className="text-[13px] font-medium text-ink">No deadlines due today</p><p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">This view uses saved commitment deadlines. No calendar is connected.</p></div>}
            {dayPlan?.tradeoffs_made?.length ? <p className="mt-3 border-t border-line-subtle pt-3 text-[11px] text-ink-muted">{dayPlan.tradeoffs_made.length} planning trade-off{dayPlan.tradeoffs_made.length === 1 ? "" : "s"} recorded</p> : null}
          </CardBody>
        </Card>

        <Card className="!rounded-2xl">
          <CardHeader title="Agent activity" subtitle="Saved runs from your workspace" icon={<Sparkles className="h-4 w-4" strokeWidth={1.8} />} action={<Link href="/agents" aria-label="Open agent center" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-sunken hover:text-brand"><ArrowRight className="h-4 w-4" /></Link>} />
          <CardBody className="pt-2">
            {agentRunsLoading ? <p role="status" className="py-1 text-[12px] text-ink-secondary">Loading saved runs…</p> : agentRunsError ? <div role="alert" className="space-y-2"><p className="py-1 text-[13px] leading-relaxed text-ink-secondary">Could not load saved runs.</p><button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["agentRuns"] })} className="min-h-9 rounded-lg border border-line px-3 text-[12px] font-semibold text-brand hover:bg-surface-muted">Retry</button></div> : agentRuns.length ? <ul className="space-y-1">{agentRuns.slice(0, 4).map((run) => <li key={run.id}>
              <Link href="/agents" className="flex min-h-[52px] items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-surface-muted">
                <span className={`h-2 w-2 shrink-0 rounded-full ${run.status === "COMPLETED" ? "bg-[#7da48e]" : run.status === "FAILED" || run.status === "BLOCKED" ? "bg-[#c47f7f]" : run.status === "RUNNING" || run.status === "PLANNING" ? "bg-[#8097c4]" : "bg-[#a9b4c0]"}`} aria-hidden="true" />
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-ink">{run.task_description}</span><span className="mt-0.5 block text-[11px] text-ink-muted">{agentStatus(run.status)} · {displayDate(run.created_at)}</span></span>
              </Link>
            </li>)}</ul> : <div className="py-2"><p className="text-[13px] font-medium text-ink">No agent runs yet</p><p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">Saved runs will appear here when you use an agent workflow.</p></div>}
          </CardBody>
        </Card>

        <Card className="!rounded-2xl">
          <CardHeader title="Quick actions" subtitle="Start with a workspace" icon={<Plus className="h-4 w-4" strokeWidth={1.8} />} divided={false} />
          <CardBody className="grid grid-cols-2 gap-2 pt-0">
            {shortcuts.map((action) => {
              const Icon = action.icon;
              return <Link key={action.title} href={action.href} className="workspace-quick-action min-w-0 flex-col items-start !gap-2 !p-3 focus-visible:outline-offset-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.tint}`}><Icon className="h-4 w-4" strokeWidth={1.8} /></span>
                <span className="line-clamp-2 text-[12px] font-medium leading-[1.35] text-ink-secondary">{action.title}</span>
              </Link>;
            })}
          </CardBody>
        </Card>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center gap-2 text-ink-tertiary"><Clock3 className="h-3.5 w-3.5" /><p className="text-[11px] font-semibold uppercase tracking-[0.12em]">A quieter kind of productivity</p></div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">Your workspace shows information you saved and actions you chose. External tasks still wait for a real integration and your approval.</p>
        </div>
      </aside>

      <ActionPassportModal passport={selectedPassport} isOpen={isPassportOpen} onClose={() => setIsPassportOpen(false)} onActionDecided={() => {
        ["actions", "commitments", "risks"].forEach((key) => void queryClient.invalidateQueries({ queryKey: [key] }));
      }} />
    </div>
  );
}
