"use client";

import { CalendarDays, Check, Globe2, Mic, PlugZap, Search, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";

const icons: Record<string, React.ElementType> = {
  tavily_search: Search,
  nvidia_nim: Sparkles,
  nvidia_parakeet: Mic,
  google_calendar: CalendarDays,
  gmail: Globe2,
  google_drive: Globe2,
};

export default function IntegrationsPage() {
  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api.getIntegrations(),
  });

  const statusTone = (status: string) => {
    if (status === "CONFIGURED" || status === "CONNECTED") return "info" as const;
    if (status === "NOT_CONFIGURED" || status === "DEMO_FALLBACK") return "warning" as const;
    if (status === "COMING_SOON") return "info" as const;
    return "neutral" as const;
  };

  const statusHint = (item: (typeof integrations)[number]) => {
    if (item.status === "CONFIGURED") return "Credentials and model configured; network connectivity not checked";
    if (item.status === "CONNECTED") return "Connected";
    if (item.status === "COMING_SOON") return "Coming Soon — not wired live";
    if (item.status === "DEMO_FALLBACK") return "Local mode; no live provider configured";
    if (item.status === "NOT_CONNECTED" && item.credentials_present) return "Credentials present; live access not verified";
    return "Not connected — awaiting setup";
  };

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Provider configuration"
        title="Integrations"
        description="See which provider credentials are configured. A configured key does not mean that live connectivity has been verified."
        icon={<PlugZap className="h-5 w-5" />}
      />
      {isLoading ? (
        <LoadingState label="Checking integrations" rows={4} />
      ) : integrations.length === 0 ? (
        <EmptyState
          icon={PlugZap}
          title="No integration status yet"
          description="The API will report configured research, intelligence and calendar sources here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {integrations.map((item) => {
            const Icon = icons[item.id] || PlugZap;
            const configured = item.status === "CONFIGURED" || item.status === "CONNECTED";
            return (
              <Card key={item.id} className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-pale text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <Badge tone={statusTone(item.status)} dot>
                    {item.status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <h2 className="mt-5 text-base font-semibold text-ink">{item.provider}</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
                  {item.metadata_json?.purpose || "External context source"}
                </p>
                {item.metadata_json?.note ? (
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                    {item.metadata_json.note}
                  </p>
                ) : null}
                <div className="mt-5 flex items-center gap-2 text-xs text-ink-muted">
                  {configured ? <Check className="h-3.5 w-3.5 text-info" /> : null}
                  {statusHint(item)}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
