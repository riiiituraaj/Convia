"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  CircleCheckBig,
  Filter,
  Pencil,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ActionPassport, Commitment } from "@/lib/types";
import { daysUntil, isClosed, sortByDeadline } from "@/lib/ui";
import { CommitmentCard } from "@/components/commitments/CommitmentCard";
import { ActionPassportModal } from "@/components/risks/ActionPassportModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { FilterTabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "TODAY", label: "Today" },
  { value: "THIS_WEEK", label: "This week" },
  { value: "AT_RISK", label: "At risk" },
  { value: "WAITING", label: "Waiting" },
  { value: "COMPLETED", label: "Completed" },
];

/**
 * Local mirror of the backend filter semantics, extended with TODAY / THIS_WEEK
 * so every filter chip actually filters. The API contract is untouched.
 */
function applyFilter(commitments: Commitment[], filter: string): Commitment[] {
  switch (filter) {
    case "AT_RISK":
      return commitments.filter(
        (c) => c.risk_level === "HIGH" || c.risk_level === "CRITICAL" || c.status === "AT_RISK"
      );
    case "WAITING":
      return commitments.filter((c) => c.recipient && !isClosed(c.status));
    case "COMPLETED":
      return commitments.filter((c) => isClosed(c.status));
    case "TODAY":
      return commitments.filter((c) => {
        const days = daysUntil(c.deadline);
        return days !== null && days <= 0 && !isClosed(c.status);
      });
    case "THIS_WEEK":
      return commitments.filter((c) => {
        const days = daysUntil(c.deadline);
        return days !== null && days <= 7 && !isClosed(c.status);
      });
    default:
      return commitments;
  }
}

function CommitmentsContent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilter = searchParams.get("filter")?.toUpperCase() || "ALL";
  const [activeFilter, setActiveFilter] = useState(
    FILTERS.some((f) => f.value === initialFilter) ? initialFilter : "ALL"
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<Commitment | null>(null);
  const [editAction, setEditAction] = useState("");
  const [editRecipient, setEditRecipient] = useState("");
  const [editContext, setEditContext] = useState("");
  const [editPriority, setEditPriority] = useState("MEDIUM");
  const [editDeadline, setEditDeadline] = useState("");
  const [editConsequences, setEditConsequences] = useState("");
  const [selectedPassport, setSelectedPassport] = useState<ActionPassport | null>(null);
  const [isPassportOpen, setIsPassportOpen] = useState(false);
  const { data: risks = [] } = useQuery({
    queryKey: ["risks"],
    queryFn: () => api.getRisks(),
  });

  const [action, setAction] = useState("");
  const [recipient, setRecipient] = useState("");
  const [context, setContext] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [deadline, setDeadline] = useState("");

  const { data: commitments = [], isLoading } = useQuery({
    queryKey: ["commitments", "ALL"],
    queryFn: () => api.getCommitments("ALL"),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["actions"],
    queryFn: () => api.getActions(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createCommitment({
        action,
        recipient: recipient || undefined,
        context: context || undefined,
        priority: priority as any,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      queryClient.invalidateQueries({ queryKey: ["blindSpots"] });
      toast({
        title: "Commitment captured",
        description: "CONVIA is now watching this obligation.",
      });
      setShowCreateModal(false);
      setAction("");
      setRecipient("");
      setContext("");
      setDeadline("");
    },
    onError: () =>
      toast({ title: "Could not save commitment", tone: "danger" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      api.updateCommitment(id, { status: newStatus as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      toast({ title: "Loop closed", description: "The commitment thread is closed." });
    },
    onError: () => toast({ title: "Could not update commitment", tone: "danger" }),
  });

  const openEdit = (commitment: Commitment) => {
    setEditingCommitment(commitment);
    setEditAction(commitment.action);
    setEditRecipient(commitment.recipient || "");
    setEditContext(commitment.context || "");
    setEditPriority(commitment.priority);
    setEditDeadline(
      commitment.deadline ? commitment.deadline.slice(0, 16) : ""
    );
    setEditConsequences(commitment.consequences || "");
  };

  const editMutation = useMutation({
    mutationFn: () => {
      if (!editingCommitment) throw new Error("No commitment selected");
      return api.updateCommitment(editingCommitment.id, {
        action: editAction,
        recipient: editRecipient || null,
        context: editContext || null,
        priority: editPriority as any,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
        consequences: editConsequences || null,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      toast({ title: "Commitment updated", description: "The thread reflects your changes." });
      setEditingCommitment(null);
    },
    onError: () => toast({ title: "Could not update commitment", tone: "danger" }),
  });

  const filtered = useMemo(() => applyFilter(commitments, activeFilter), [commitments, activeFilter]);

  const openCount = commitments.filter((c) => !isClosed(c.status)).length;
  const atRiskCount = applyFilter(commitments, "AT_RISK").length;
  const waitingCount = applyFilter(commitments, "WAITING").length;
  const completedCount = applyFilter(commitments, "COMPLETED").length;

  const activePassport = actions.find((a) => a.status === "PENDING_APPROVAL");

  const inspectCommitmentRisk = (commitment: Commitment) => {
    const relatedRisk = risks.find((r) => r.commitment_id === commitment.id && !r.is_resolved);
    if (relatedRisk?.recovery_strategies.length) {
      toast({
        title: "Recovery available",
        description: "Open Risk center to choose a recovery path for this commitment.",
      });
      router.push("/risks");
      return;
    }
    const relatedPassport =
      actions.find((a) => a.commitment_id === commitment.id && a.status === "PENDING_APPROVAL") ||
      actions.find((a) => a.commitment_id === commitment.id) ||
      activePassport;
    if (relatedPassport) {
      setSelectedPassport(relatedPassport);
      setIsPassportOpen(true);
    } else {
      toast({
        title: "No recovery path yet",
        description: "CONVIA has not prepared a passport for this commitment.",
        tone: "danger",
      });
    }
  };

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="The central primitive"
        title="Commitment center"
        description="A commitment is an obligation in context, with actors, recipients, deadlines, dependencies and consequences. CONVIA watches every one of them."
        icon={<CircleCheckBig className="h-5 w-5" strokeWidth={1.75} />}
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.9} />
            New commitment
          </Button>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-ink-secondary">
              <Filter className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.9} />
              {filtered.length} of {commitments.length} shown
            </span>
            {activePassport ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedPassport(activePassport);
                  setIsPassportOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#F7E2B8] bg-warning-light px-2.5 py-1 text-[12px] font-medium text-[#B87A0E] transition-colors hover:bg-[#FDEBCB]"
              >
                <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
                Action passport awaiting approval
              </button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open commitments"
          value={openCount}
          icon={CircleCheckBig}
          tone="brand"
          hint="Threads still in flight"
        />
        <StatCard
          label="At risk"
          value={atRiskCount}
          icon={ShieldAlert}
          tone={atRiskCount ? "danger" : "success"}
          trendPositive={false}
          hint="High or critical risk"
        />
        <StatCard
          label="People waiting"
          value={waitingCount}
          icon={Users}
          tone={waitingCount ? "warning" : "success"}
          hint="Someone depends on you"
        />
        <StatCard
          label="Closed loops"
          value={completedCount}
          icon={CheckCircle2}
          tone="info"
          hint="Completed and verified"
        />
      </div>

      <FilterTabs
        options={FILTERS}
        value={activeFilter}
        onChange={setActiveFilter}
        ariaLabel="Filter commitments"
      />

      {isLoading ? (
        <LoadingState label="Loading commitments" rows={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={commitments.length === 0 ? CircleCheckBig : CalendarClock}
          title={commitments.length === 0 ? "No commitments yet" : "Nothing matches this filter"}
          description={
            commitments.length === 0
              ? "Type or speak what you owe someone and CONVIA will track it end to end."
              : "Try a different filter, or load the flagship demo to explore CONVIA with real data."
          }
          action={
            commitments.length === 0 ? (
              <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" strokeWidth={1.9} />
                New commitment
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => api.seedFlagshipDemo().then(() => window.location.reload())}
              >
                Load flagship demo
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sortByDeadline(filtered).map((commitment) => (
            <CommitmentCard
              key={commitment.id}
              commitment={commitment}
              onStatusChange={(id, newStatus) => statusMutation.mutate({ id, newStatus })}
              onInspectRisk={inspectCommitmentRisk}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New commitment"
        subtitle="Capture an obligation so CONVIA can protect it"
        eyebrow="Explicit commitment"
        icon={<CircleCheckBig className="h-4 w-4" strokeWidth={1.8} />}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!action.trim()}
              loading={createMutation.isPending}
            >
              {createMutation.isPending ? "Saving..." : "Add commitment"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Action obligation" htmlFor="commitment-action">
            <Input
              id="commitment-action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="e.g. Deliver Phoenix API documentation"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recipient / stakeholder" htmlFor="commitment-recipient">
              <Input
                id="commitment-recipient"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="e.g. Rahul / Engineering team"
              />
            </Field>
            <Field label="Context / project" htmlFor="commitment-context">
              <Input
                id="commitment-context"
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="e.g. Phoenix launch"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority" htmlFor="commitment-priority">
              <Select
                id="commitment-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </Field>
            <Field label="Deadline" htmlFor="commitment-deadline" hint="Optional, but it powers due-soon tracking.">
              <Input
                id="commitment-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(editingCommitment)}
        onClose={() => setEditingCommitment(null)}
        title="Edit commitment"
        subtitle="Adjust the obligation without losing the thread"
        eyebrow="Thread update"
        icon={<Pencil className="h-4 w-4" strokeWidth={1.8} />}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingCommitment(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={!editAction.trim()}
              loading={editMutation.isPending}
            >
              {editMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Action obligation" htmlFor="edit-commitment-action">
            <Input
              id="edit-commitment-action"
              value={editAction}
              onChange={(event) => setEditAction(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recipient / stakeholder" htmlFor="edit-commitment-recipient">
              <Input
                id="edit-commitment-recipient"
                value={editRecipient}
                onChange={(event) => setEditRecipient(event.target.value)}
              />
            </Field>
            <Field label="Context / project" htmlFor="edit-commitment-context">
              <Input
                id="edit-commitment-context"
                value={editContext}
                onChange={(event) => setEditContext(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority" htmlFor="edit-commitment-priority">
              <Select
                id="edit-commitment-priority"
                value={editPriority}
                onChange={(event) => setEditPriority(event.target.value)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </Field>
            <Field label="Deadline" htmlFor="edit-commitment-deadline">
              <Input
                id="edit-commitment-deadline"
                type="datetime-local"
                value={editDeadline}
                onChange={(event) => setEditDeadline(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Consequence if missed" htmlFor="edit-commitment-consequences">
            <Input
              id="edit-commitment-consequences"
              value={editConsequences}
              onChange={(event) => setEditConsequences(event.target.value)}
              placeholder="e.g. Rahul blocks the launch review"
            />
          </Field>
        </div>
      </Modal>

      <ActionPassportModal
        passport={selectedPassport}
        isOpen={isPassportOpen}
        onClose={() => setIsPassportOpen(false)}
        onActionDecided={() => {
          queryClient.invalidateQueries({ queryKey: ["commitments"] });
          queryClient.invalidateQueries({ queryKey: ["actions"] });
        }}
      />

    </div>
  );
}

export default function CommitmentsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading commitments" rows={3} />}>
      <CommitmentsContent />
    </Suspense>
  );
}
