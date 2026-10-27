"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { PersonCard } from "@/components/commitments/PersonCard";

export default function PeoplePage() {
  const { data: people = [], isLoading } = useQuery({
    queryKey: ["people"],
    queryFn: () => api.getPeople(),
  });

  const peopleWithOpenRecords = people.filter(
    (p) => p.waiting_on_user.length > 0 || p.user_waiting_on.length > 0
  );
  const peopleClear = people.filter(
    (p) => p.waiting_on_user.length === 0 && p.user_waiting_on.length === 0
  );

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Saved recipients"
        title="People"
        description="Review recipients and stakeholders saved on your commitments."
        icon={<Users className="h-5 w-5" strokeWidth={1.75} />}
        meta={
          <>
            <Badge tone="brand" dot>{people.length} people</Badge>
            <Badge tone="warning" dot>{peopleWithOpenRecords.length} with open records</Badge>
          </>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading people" rows={3} />
      ) : people.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No recipients saved yet"
          description="Recipients you add to commitments will appear here. CONVIA does not infer relationship status."
        />
      ) : (
        <>
          {peopleWithOpenRecords.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-ink">With open records</h2>
                <Badge tone="warning" dot>
                  {peopleWithOpenRecords.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {peopleWithOpenRecords.map((person) => (
                  <PersonCard key={person.name} person={person} />
                ))}
              </div>
            </section>
          )}

          {peopleClear.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-ink">No open records</h2>
                <Badge tone="success" dot>
                  {peopleClear.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {peopleClear.map((person) => (
                  <PersonCard key={person.name} person={person} />
                ))}
              </div>
            </section>
          )}

          <Card>
            <CardBody>
              <p className="text-[12.5px] leading-relaxed text-ink-secondary">
                People appear here when a recipient is saved on a commitment. Intent capture does not yet extract
                names from free text, so add the recipient in the commitment form to include them in this view.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
