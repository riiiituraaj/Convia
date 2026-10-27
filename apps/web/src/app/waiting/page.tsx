"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Clock, AlertTriangle, ArrowRight, UserCheck, UserX } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/Toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function WaitingPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: waiting, isLoading } = useQuery({
    queryKey: ["waiting"],
    queryFn: () => api.getWaiting(),
  });

  const { data: commitments = [] } = useQuery({
    queryKey: ["commitments"],
    queryFn: () => api.getCommitments("ALL"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      api.updateCommitment(id, { status: newStatus as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      queryClient.invalidateQueries({ queryKey: ["waiting"] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      toast({ title: "Loop closed", description: "The commitment thread is now closed." });
    },
    onError: () =>
      toast({
        title: "Could not update commitment",
        description: "The server rejected the change. Nothing was modified.",
        tone: "danger",
      }),
  });

  const theyWaitOnYou = waiting?.they_wait_on_you || [];
  const youWaitOnThem = waiting?.you_wait_on_them || [];

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Commitment relationships"
        title="Recipients & dependencies"
        description="Items grouped by recipients and dependencies saved on your commitments. These records do not confirm another person's current status."
        icon={<Users className="h-5 w-5" strokeWidth={1.75} />}
        meta={
          <>
            <Badge tone="warning" dot>{theyWaitOnYou.length} recipient linked</Badge>
            <Badge tone="info" dot>{youWaitOnThem.length} explicit dependencies</Badge>
          </>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading waiting state" rows={2} />
      ) : theyWaitOnYou.length === 0 && youWaitOnThem.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No recipient or dependency records"
          description="Add recipients or explicit dependencies to commitments to see them here."
        />
      ) : (
        <>
          {/* Commitments with recipients */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-warning-light bg-warning-light text-warning">
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <h2 className="text-[17px] font-semibold text-ink">Commitments with recipients</h2>
              </div>
              <Badge tone="warning" dot>{theyWaitOnYou.length}</Badge>
            </div>

            {theyWaitOnYou.length === 0 ? (
              <Card>
                <CardBody className="py-8 text-center">
                  <UserCheck className="h-10 w-10 mx-auto text-success" strokeWidth={1.5} />
                  <p className="mt-3 text-[13px] text-ink-secondary">No open commitments currently list a recipient.</p>
                </CardBody>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {theyWaitOnYou.map((item) => {
                  const commitment = commitments.find((c) => c.id === item.commitment_id);
                  return (
                    <Card key={item.commitment_id} interactive className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-warning-light bg-warning-light text-warning">
                            <Users className="h-5 w-5" strokeWidth={1.8} />
                          </span>
                          <div>
                            <h3 className="text-[14px] font-semibold text-ink">{item.person}</h3>
                            <p className="mt-0.5 text-[12px] text-ink-secondary">{item.context || "General"}</p>
                          </div>
                        </div>
                        <Badge tone="warning" dot>{item.status}</Badge>
                      </div>

                      <p className="mt-3 text-[13.5px] font-medium text-ink">{item.action}</p>

                      {item.deadline && (
                        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-secondary">
                          <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
                          Due {formatDateTime(item.deadline)}
                        </p>
                      )}

                      {item.consequences && (
                        <p className="mt-2 text-[12px] text-ink-muted">{item.consequences}</p>
                      )}

                      {commitment && (
                        <div className="mt-4 pt-3 border-t border-line-subtle">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand transition-colors hover:text-brand-deep"
                            onClick={() => statusMutation.mutate({ id: commitment.id, newStatus: "COMPLETED" })}
                          >
                            Mark complete
                            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                          </button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Explicit dependencies */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-info-light bg-info-light text-info">
                  <Clock className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <h2 className="text-[17px] font-semibold text-ink">Explicit dependencies on others</h2>
              </div>
              <Badge tone="info" dot>{youWaitOnThem.length}</Badge>
            </div>

            {youWaitOnThem.length === 0 ? (
              <Card>
                <CardBody className="py-8 text-center">
                  <UserCheck className="h-10 w-10 mx-auto text-success" strokeWidth={1.5} />
                  <p className="mt-3 text-[13px] text-ink-secondary">No open commitments list a dependency on another person.</p>
                </CardBody>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {youWaitOnThem.map((item) => {
                  const commitment = commitments.find((c) => c.id === item.commitment_id);
                  return (
                    <Card key={item.commitment_id} interactive className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-info-light bg-info-light text-info">
                            <UserX className="h-5 w-5" strokeWidth={1.8} />
                          </span>
                          <div>
                            <h3 className="text-[14px] font-semibold text-ink">{item.person}</h3>
                            <p className="mt-0.5 text-[12px] text-ink-secondary">Dependency: {item.waiting_for}</p>
                          </div>
                        </div>
                        <Badge tone="info" dot>{item.status}</Badge>
                      </div>

                      <p className="mt-3 text-[13.5px] font-medium text-ink">{item.action}</p>

                      {commitment?.deadline && (
                        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-secondary">
                          <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
                          Due {formatDateTime(commitment.deadline)}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <Card>
            <CardBody>
              <p className="text-[12.5px] leading-relaxed text-ink-secondary">
                Recipient and dependency fields are supplied by you. A recipient is shown with its
                open commitment, and a dependency is shown with the person and action recorded in that field.
                CONVIA does not verify another person&apos;s status.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
