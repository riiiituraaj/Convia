"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock3,
  Loader2,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
  Info,
  ShieldCheck,
  CheckCircle2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ContextDiagnostics } from "@/lib/types";

export default function ConversationsPage() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsData, setDiagnosticsData] = useState<ContextDiagnostics | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const pendingRequest = useRef<{ text: string; id: string } | null>(null);

  const listQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
  });

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) {
      setActiveId(id);
      setComposing(false);
    }
  }, []);

  useEffect(() => {
    if (!window.location.hash && !composing && !activeId && listQuery.data?.length) {
      setActiveId(listQuery.data[0].id);
    }
  }, [activeId, composing, listQuery.data]);

  const detailQuery = useQuery({
    queryKey: ["conversation", activeId],
    queryFn: () => api.getConversation(activeId as string),
    enabled: Boolean(activeId),
  });

  const sendMutation = useMutation({
    mutationFn: async ({ text, requestId }: { text: string; requestId: string }) => {
      if (composing || !activeId) {
        const conv = await api.createConversation(text.slice(0, 60));
        const targetId = conv.id;
        setActiveId(targetId);
        setComposing(false);
        return api.sendMessage(targetId, text, "text", requestId);
      }
      return api.sendMessage(activeId, text, "text", requestId);
    },
    onSuccess: async (result) => {
      pendingRequest.current = null;
      setDraft("");
      setError("");
      if (result.diagnostics) {
        setDiagnosticsData(result.diagnostics);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["conversation", activeId] }),
      ]);
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "Could not send message."),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sendMutation.isPending) return;
    setError("");
    const requestId = pendingRequest.current?.text === text
      ? pendingRequest.current.id
      : crypto.randomUUID();
    pendingRequest.current = { text, id: requestId };
    sendMutation.mutate({ text, requestId });
  };

  const beginNew = () => {
    setActiveId(null);
    setComposing(true);
    setDraft("");
    setError("");
    setDiagnosticsData(null);
    pendingRequest.current = null;
  };

  const openDiagnostics = async () => {
    if (!activeId) return;
    setLoadingDiagnostics(true);
    setShowDiagnostics(true);
    try {
      const diag = await api.getContextPreview(activeId);
      setDiagnosticsData(diag);
    } catch (err) {
      setError("Could not load context diagnostics.");
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  const activeConversation = detailQuery.data;
  const hasContent = Boolean(activeConversation?.messages.length);
  const activeConstraints = diagnosticsData?.active_constraints || {};

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Conversations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">
            Multi-turn stateful conversational intelligence. CONVIA retains your objectives, constraints, and facts without forcing restatement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeId && !composing && (
            <Button variant="secondary" onClick={openDiagnostics}>
              <Info className="mr-2 h-4 w-4 text-brand" /> Context Engine
            </Button>
          )}
          <Button variant="primary" onClick={beginNew}>
            <Plus className="mr-2 h-4 w-4" /> New conversation
          </Button>
        </div>
      </header>

      {/* Constraints chips banner if constraints exist */}
      {Object.keys(activeConstraints).length > 0 && (
        <section aria-label="Active constraints" className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/20 bg-brand-pale/50 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-brand">
            <ShieldCheck className="h-4 w-4" /> Retained Constraints:
          </span>
          {activeConstraints.destination && (
            <span className="inline-flex items-center rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
              📍 Destination: {String(activeConstraints.destination)}
            </span>
          )}
          {activeConstraints.budget_limit && (
            <span className="inline-flex items-center rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
              💰 Budget: &lt; ₹{Number(activeConstraints.budget_limit).toLocaleString()}
            </span>
          )}
          {activeConstraints.headcount && (
            <span className="inline-flex items-center rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
              👥 {String(activeConstraints.headcount)} travelers
            </span>
          )}
          {activeConstraints.duration && (
            <span className="inline-flex items-center rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
              🌙 {String(activeConstraints.duration)} night(s)
            </span>
          )}
        </section>
      )}

      <div className="grid min-h-[580px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Saved threads</h2>
            <p className="mt-1 text-xs text-ink-muted">Scoped to your active account</p>
          </div>
          <div className="max-h-[540px] overflow-y-auto p-2">
            {listQuery.isLoading ? (
              <div className="flex items-center gap-2 px-3 py-5 text-sm text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading history
              </div>
            ) : listQuery.data?.length ? (
              listQuery.data.map((conversation) => {
                const selected = activeId === conversation.id && !composing;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setActiveId(conversation.id);
                      setComposing(false);
                      setError("");
                    }}
                    className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition-colors ${selected ? "bg-brand-pale text-brand" : "hover:bg-surface-sunken"}`}
                  >
                    <span className="block truncate text-sm font-medium text-ink">{conversation.title}</span>
                    <span className="mt-1 block truncate text-xs text-ink-secondary">
                      {conversation.last_message_preview || "No messages yet"}
                    </span>
                    <span className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
                      <Clock3 className="h-3 w-3" /> {formatDateTime(conversation.updated_at)}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-5 text-sm leading-6 text-ink-muted">Your conversation threads will appear here.</p>
            )}
          </div>
        </aside>

        <section className="flex min-h-[580px] flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-brand" />
              <h2 className="truncate text-sm font-semibold text-ink">
                {composing ? "New thread" : activeConversation?.title || "Select a conversation"}
              </h2>
            </div>
            {!composing && activeId && (
              <span className="text-xs text-ink-muted">
                {activeConversation?.messages.length || 0} messages
              </span>
            )}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {detailQuery.isLoading && !composing ? (
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading messages
              </div>
            ) : null}

            {!composing && !activeId && !listQuery.isLoading ? (
              <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
                <MessageSquareText className="h-8 w-8 text-brand" />
                <h3 className="mt-4 text-lg font-semibold text-ink">Start a conversation</h3>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  Ask questions, plan journeys, or delegate tasks. Constraints are tracked and remembered.
                </p>
                <Button className="mt-5" variant="secondary" onClick={beginNew}>New conversation</Button>
              </div>
            ) : null}

            {!composing && activeConversation?.messages.map((message) => {
              const isUser = message.role === "USER";
              const isFailed = message.status === "FAILED";
              return (
                <article
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-3.5 ${
                    isUser
                      ? "ml-auto bg-brand text-white"
                      : isFailed
                      ? "bg-danger-subtle text-danger border border-danger/20"
                      : "bg-surface-sunken text-ink border border-line"
                  }`}
                >
                  <div className={`mb-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide ${isUser ? "text-white" : "text-ink-muted"}`}>
                    <span>{isUser ? "You" : "CONVIA Engine"}</span>
                    <span className="font-normal lowercase">{formatDateTime(message.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  {message.metadata_json?.model_used ? (
                    <p className={`mt-2 text-[11.5px] ${isUser ? "text-white" : "text-ink-muted"}`}>
                      Model: {String(message.metadata_json.model_used)}
                    </p>
                  ) : null}
                </article>
              );
            })}

            {!composing && activeConversation && !hasContent ? (
              <p className="py-10 text-center text-sm text-ink-muted">Start typing below to begin this thread.</p>
            ) : null}

            {composing ? (
              <div className="mx-auto max-w-lg py-12 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-brand" />
                <h3 className="mt-4 text-lg font-semibold text-ink">Multi-Turn Stateful Continuity</h3>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  State your goal. Follow-up with constraints like budgets, dates, or guests. CONVIA preserves the thread.
                </p>
              </div>
            ) : null}
          </div>

          <form onSubmit={submit} className="border-t border-line p-4">
            {error ? <p role="alert" className="mb-3 text-sm text-danger">{error}</p> : null}
            <label htmlFor="conversation-input" className="sr-only">Your message</label>
            <div className="flex items-end gap-3">
              <textarea
                id="conversation-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={10000}
                rows={3}
                placeholder="Type your message or follow-up constraint (e.g. 'Keep total budget under ₹10,000')…"
                className="min-h-[80px] flex-1 resize-y rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <Button type="submit" variant="primary" disabled={!draft.trim() || sendMutation.isPending}>
                {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send
              </Button>
            </div>
            <p className="mt-2 text-right text-[11px] text-ink-muted">{draft.length}/10000</p>
          </form>
        </section>
      </div>

      {/* Context Engine Diagnostics Modal */}
      {showDiagnostics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,43,69,0.52)] p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-brand" />
                <h3 className="text-lg font-semibold text-ink">Context Engine Diagnostics</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnostics(false)}
                className="rounded-lg p-1 text-ink-muted hover:bg-surface-sunken"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto py-4 text-sm text-ink">
              {loadingDiagnostics ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                </div>
              ) : diagnosticsData ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-surface-sunken p-3">
                      <p className="text-xs text-ink-muted">Total Items</p>
                      <p className="mt-1 text-lg font-bold text-ink">{diagnosticsData.total_items}</p>
                    </div>
                    <div className="rounded-xl bg-surface-sunken p-3">
                      <p className="text-xs text-ink-muted">History Turns</p>
                      <p className="mt-1 text-lg font-bold text-ink">{diagnosticsData.history_message_count}</p>
                    </div>
                    <div className="rounded-xl bg-surface-sunken p-3">
                      <p className="text-xs text-ink-muted">Truncated</p>
                      <p className="mt-1 text-lg font-bold text-ink">{diagnosticsData.truncated ? "Yes" : "No"}</p>
                    </div>
                    <div className="rounded-xl bg-surface-sunken p-3">
                      <p className="text-xs text-ink-muted">Summary</p>
                      <p className="mt-1 text-lg font-bold text-ink">{diagnosticsData.summary_applied ? "Active" : "None"}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-ink">Active Constraints</h4>
                    <pre className="mt-1.5 overflow-x-auto rounded-xl bg-surface-sunken p-3 text-xs text-ink">
                      {JSON.stringify(diagnosticsData.active_constraints, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold text-ink">Selected Context Sources ({diagnosticsData.items.length})</h4>
                    <div className="mt-2 space-y-2">
                      {diagnosticsData.items.map((it, idx) => (
                        <div key={idx} className="rounded-xl border border-line bg-surface p-3">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="rounded bg-brand-pale px-2 py-0.5 text-brand uppercase tracking-wider text-[10px]">
                              {it.provenance}
                            </span>
                            <span className="text-ink-muted text-[11px]">{it.category}</span>
                          </div>
                          <p className="mt-2 text-xs text-ink-secondary">{it.snippet}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-ink-muted">No diagnostic context collected yet.</p>
              )}
            </div>

            <div className="border-t border-line pt-4 text-right">
              <Button variant="secondary" onClick={() => setShowDiagnostics(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
