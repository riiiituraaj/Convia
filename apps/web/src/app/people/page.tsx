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

  const peopleWithWaiting = people.filter(
    (p) => p.waiting_on_user.length > 0 || p.user_waiting_on.length > 0
  );
  const peopleClear = people.filter(
    (p) => p.waiting_on_user.length === 0 && p.user_waiting_on.length === 0
  );

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Human connections"
        title="People"
        description="CONVIA tracks who you owe, who owes you, and what&apos;s at stake in every relationship."
        icon={<Users className="h-5 w-5" strokeWidth={1.75} />}
        meta={
          <>
            <Badge tone="brand" dot>{people.length} people</Badge>
            <Badge tone="warning" dot>{peopleWithWaiting.length} need attention</Badge>
          </>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading people" rows={3} />
      ) : people.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No relationships tracked yet"
          description="Commitments with recipients will automatically appear here."
        />
      ) : (
        <>
          {peopleWithWaiting.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-ink">Needs attention</h2>
                <Badge tone="warning" dot>
                  {peopleWithWaiting.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {peopleWithWaiting.map((person) => (
                  <PersonCard key={person.name} person={person} />
                ))}
              </div>
            </section>
          )}

          {peopleClear.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-ink">Clear</h2>
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
                People are inferred from your commitments. When you tell CONVIA &quot;I promised Rahul the design
                tonight&quot; or &quot;Priya owes me the dataset&quot;, CONVIA builds a relationship graph so you always know
                who is waiting on you and who you&apos;re waiting on.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}