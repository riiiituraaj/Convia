"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  FolderOpen,
  LoaderCircle,
  Mail,
  PlugZap,
  Search,
  Sparkles,
  Unplug,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import type { IntegrationItem } from "@/lib/types";

const icons: Record<string, React.ElementType> = {
  tavily_search: Search,
  nvidia_nim: Sparkles,
  nvidia_parakeet: Sparkles,
  google_calendar: CalendarDays,
  gmail: Mail,
  google_drive: FolderOpen,
};

function dateLabel(value?: string | null) {
  if (!value) return "Time not provided";
  const isDateOnly = value.length === 10 && value[4] === "-" && value[7] === "-";
  const date = isDateOnly ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function errorLabel(error: unknown) {
  return error instanceof Error ? error.message : "Could not load this Google data.";
}

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState("");
  const [gmailQuery, setGmailQuery] = useState("");
  const [gmailSearch, setGmailSearch] = useState("");
  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api.getIntegrations(),
  });

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const result = query.get("google");
    const messages: Record<string, string> = {
      connected: "Google Workspace connected. CONVIA enabled the read-only services you approved.",
      denied: "Google access was not granted.",
      scope_error: "Google did not grant any requested read-only scopes. Review the permissions and try again.",
      refresh_error: "Google did not issue a refresh token. Reconnect and approve the consent prompt.",
    };
    if (result && messages[result]) {
      setBanner(messages[result]);
      window.history.replaceState({}, "", window.location.pathname);
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
    }
  }, [queryClient]);

  const gmailConnected = integrations.some((item) => item.id === "gmail" && item.status === "CONNECTED");
  const calendarConnected = integrations.some((item) => item.id === "google_calendar" && item.status === "CONNECTED");
  const driveConnected = integrations.some((item) => item.id === "google_drive" && item.status === "CONNECTED");
  const googleConnected = gmailConnected || calendarConnected || driveConnected;
  const googleConfigured = integrations.some(
    (item) => ["gmail", "google_calendar", "google_drive"].includes(item.id) && item.metadata_json?.oauth_configured,
  );

  const connect = useMutation({
    mutationFn: () => api.connectGoogle(),
    onSuccess: ({ authorization_url }) => window.location.assign(authorization_url),
    onError: (error) => setBanner(errorLabel(error)),
  });
  const disconnect = useMutation({
    mutationFn: () => api.disconnectGoogle(),
    onSuccess: async () => {
      setBanner("Google Workspace disconnected and its stored credentials were removed.");
      await queryClient.invalidateQueries({ queryKey: ["integrations"] });
      await queryClient.removeQueries({ queryKey: ["google-messages"] });
      await queryClient.removeQueries({ queryKey: ["google-events"] });
      await queryClient.removeQueries({ queryKey: ["google-files"] });
    },
    onError: (error) => setBanner(errorLabel(error)),
  });

  const messages = useQuery({
    queryKey: ["google-messages", gmailSearch],
    queryFn: () => api.getGoogleMessages(gmailSearch),
    enabled: gmailConnected,
  });
  const events = useQuery({
    queryKey: ["google-events"],
    queryFn: () => api.getGoogleEvents(),
    enabled: calendarConnected,
  });
  const files = useQuery({
    queryKey: ["google-files"],
    queryFn: () => api.getGoogleFiles(),
    enabled: driveConnected,
  });

  const statusTone = (status: string) => {
    if (status === "CONFIGURED" || status === "CONNECTED") return "info" as const;
    if (status === "NOT_CONFIGURED" || status === "DEMO_FALLBACK") return "warning" as const;
    if (status === "COMING_SOON") return "info" as const;
    return "neutral" as const;
  };

  const statusHint = (item: IntegrationItem) => {
    if (item.status === "CONFIGURED") return "Credentials and model configured; connectivity not checked";
    if (item.status === "CONNECTED") return "Connected and available";
    if (item.status === "COMING_SOON") return "Not wired live";
    if (item.status === "DEMO_FALLBACK") return "Local mode; no live provider configured";
    if (item.status === "NOT_CONNECTED" && item.credentials_present) return "Credentials present; live access not verified";
    return "Not connected — awaiting setup";
  };

  const submitGmailSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGmailSearch(gmailQuery.trim());
  };

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Provider configuration"
        title="Integrations"
        description="Connect external services and review which data CONVIA can access. Google Workspace uses read-only access for Gmail, Calendar, and Drive."
        icon={<PlugZap className="h-5 w-5" />}
      />

      {banner ? (
        <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-secondary" role="status">
          {banner}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState label="Checking integrations" rows={4} />
      ) : integrations.length === 0 ? (
        <EmptyState
          icon={PlugZap}
          title="No integration status yet"
          description="The API will report configured research, intelligence and calendar sources here."
        />
      ) : (
        <>
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink">Google Workspace</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-secondary">
                  Read Gmail messages, upcoming Calendar events, and Drive file metadata. CONVIA cannot send email, change events, or edit files.
                </p>
                {!googleConfigured ? (
                  <p className="mt-2 text-xs text-ink-muted">Server setup required: Google OAuth client credentials and a public HTTPS domain you control. Google does not accept a raw EC2 IP for this redirect.</p>
                ) : null}
              </div>
              {googleConnected ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => connect.mutate()}
                    disabled={!googleConfigured || connect.isPending}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {connect.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                    Update access
                  </button>
                  <button
                    type="button"
                    onClick={() => disconnect.mutate()}
                    disabled={disconnect.isPending}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-line px-4 text-sm font-medium text-ink-secondary hover:bg-surface-muted disabled:opacity-60"
                  >
                    {disconnect.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => connect.mutate()}
                  disabled={!googleConfigured || connect.isPending}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {connect.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                  Connect Google
                </button>
              )}
            </div>
          </Card>

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
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">{item.metadata_json.note}</p>
                  ) : null}
                  <div className="mt-5 flex items-center gap-2 text-xs text-ink-muted">
                    {configured ? <Check className="h-3.5 w-3.5 text-info" /> : null}
                    {statusHint(item)}
                  </div>
                </Card>
              );
            })}
          </div>

          {googleConnected ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {gmailConnected ? (
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-brand" />
                  <h2 className="font-semibold text-ink">Gmail inbox</h2>
                </div>
                <form className="mt-4 flex gap-2" onSubmit={submitGmailSearch}>
                  <input
                    aria-label="Search Gmail"
                    value={gmailQuery}
                    onChange={(event) => setGmailQuery(event.target.value)}
                    placeholder="Search Gmail"
                    className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                  />
                  <button type="submit" className="rounded-xl border border-line px-3 text-ink-secondary hover:bg-surface-muted" aria-label="Run Gmail search">
                    <Search className="h-4 w-4" />
                  </button>
                </form>
                {messages.isLoading ? <p className="py-5 text-sm text-ink-muted">Loading messages…</p> : null}
                {messages.isError ? <p className="py-5 text-sm text-danger">{errorLabel(messages.error)}</p> : null}
                {messages.data?.messages.length === 0 ? <p className="py-5 text-sm text-ink-muted">No matching messages.</p> : null}
                <ul className="mt-3 divide-y divide-line">
                  {messages.data?.messages.map((message) => (
                    <li key={message.id} className="py-3 first:pt-1">
                      <a href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(message.thread_id || message.id)}`} target="_blank" rel="noreferrer" className="group block">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${message.unread ? "font-semibold text-ink" : "font-medium text-ink-secondary"}`}>{message.subject}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-muted opacity-0 group-hover:opacity-100" />
                        </div>
                        <p className="mt-1 truncate text-xs text-ink-muted">{message.from} · {dateLabel(message.date)}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-secondary">{message.snippet}</p>
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
              ) : null}

              {calendarConnected ? (
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-brand" />
                  <h2 className="font-semibold text-ink">Upcoming events</h2>
                </div>
                {events.isLoading ? <p className="py-5 text-sm text-ink-muted">Loading events…</p> : null}
                {events.isError ? <p className="py-5 text-sm text-danger">{errorLabel(events.error)}</p> : null}
                {events.data?.events.length === 0 ? <p className="py-5 text-sm text-ink-muted">No events in the next 30 days.</p> : null}
                <ul className="mt-3 divide-y divide-line">
                  {events.data?.events.map((event) => (
                    <li key={event.id} className="py-3 first:pt-1">
                      <a href={event.html_link || "https://calendar.google.com/calendar/u/0/r"} target="_blank" rel="noreferrer" className="group block">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-ink">{event.summary}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-muted opacity-0 group-hover:opacity-100" />
                        </div>
                        <p className="mt-1 text-xs text-ink-muted">{dateLabel(event.start)}</p>
                        {event.location ? <p className="mt-1 truncate text-xs text-ink-secondary">{event.location}</p> : null}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
              ) : null}

              {driveConnected ? (
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-brand" />
                  <h2 className="font-semibold text-ink">Recent Drive files</h2>
                </div>
                {files.isLoading ? <p className="py-5 text-sm text-ink-muted">Loading files…</p> : null}
                {files.isError ? <p className="py-5 text-sm text-danger">{errorLabel(files.error)}</p> : null}
                {files.data?.files.length === 0 ? <p className="py-5 text-sm text-ink-muted">No files found.</p> : null}
                <ul className="mt-3 divide-y divide-line">
                  {files.data?.files.map((file) => (
                    <li key={file.id} className="py-3 first:pt-1">
                      <a href={file.webViewLink || `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`} target="_blank" rel="noreferrer" className="group flex items-start gap-3">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{file.name}</span>
                          <span className="mt-1 block text-xs text-ink-muted">Updated {dateLabel(file.modifiedTime)}</span>
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-muted opacity-0 group-hover:opacity-100" />
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
