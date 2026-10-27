"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, Files, FileText, Search, Sparkles, Trash2, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import type { DocumentAnswer, DocumentItem } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/Toast";

const ACCEPTED = ".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<DocumentAnswer | null>(null);
  const [search, setSearch] = useState("");
  const [summaryMode, setSummaryMode] = useState("quick");
  const [summaryPurpose, setSummaryPurpose] = useState("");

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents", search],
    queryFn: () => api.getDocuments(search),
  });
  useEffect(() => {
    const requestedId = window.location.hash.slice(1);
    if (requestedId && documents.some((document) => document.id === requestedId)) {
      setSelectedId(requestedId);
    }
  }, [documents]);
  const selected = documents.find((document) => document.id === selectedId) ?? null;
  const previewQuery = useQuery({
    queryKey: ["document-preview", selectedId],
    queryFn: () => api.previewDocument(selectedId),
    enabled: Boolean(selectedId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadDocument(file),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setSelectedId(document.id);
      setAnswer(null);
      toast({ title: "Document added", description: "Text was extracted and saved to your private vault." });
    },
    onError: (error: Error) => toast({ title: "Upload failed", description: error.message, tone: "danger" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (selectedId === id) {
        setSelectedId("");
        setAnswer(null);
      }
      toast({ title: "Document deleted" });
    },
    onError: (error: Error) => toast({ title: "Could not delete document", description: error.message, tone: "danger" }),
  });

  const askMutation = useMutation({
    mutationFn: () => api.askDocument(selectedId, question.trim()),
    onSuccess: setAnswer,
    onError: (error: Error) => toast({ title: "Could not answer", description: error.message, tone: "danger" }),
  });

  const summaryMutation = useMutation({
    mutationFn: () => api.summarizeDocument(selectedId, { mode: summaryMode, purpose: summaryPurpose }),
    onSuccess: (result) => {
      setAnswer(result);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => toast({ title: "Could not summarize document", description: error.message, tone: "danger" }),
  });

  const handleDownload = async (document: DocumentItem) => {
    try {
      const blob = await api.downloadDocument(document.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Download failed", description: error instanceof Error ? error.message : undefined, tone: "danger" });
    }
  };

  const selectDocument = (document: DocumentItem) => {
    setSelectedId(document.id);
    setAnswer(null);
    setQuestion("");
  };

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Private knowledge vault"
        title="Documents"
        description="Keep your files together, find source passages, and ask questions about their extracted text."
        icon={<Files className="h-5 w-5" strokeWidth={1.75} />}
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              aria-label="Choose a document to upload"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadMutation.mutate(file);
                event.currentTarget.value = "";
              }}
            />
            <Button onClick={() => fileInput.current?.click()} loading={uploadMutation.isPending}>
              <Upload className="h-4 w-4" /> Add document
            </Button>
          </>
        }
        meta={
          <>
            <Badge tone="brand" dot>{documents.length} stored</Badge>
            <Badge tone="neutral">PDF · Office · text · CSV</Badge>
          </>
        }
      />

      <Card className="border-brand-light bg-brand-pale p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-brand-deep" />
          <p className="text-[12.5px] leading-relaxed text-ink-secondary">
            Uploads are stored privately under your account. Adding a file extracts text on this server; it does not
            send the file to an AI provider. When you choose <strong>Ask</strong> or <strong>Summarize</strong>,
            selected extracted passages are sent to the configured inference provider. Scanned PDFs need OCR, which
            is not enabled.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)]">
        <section className="space-y-3">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a file by name"
              aria-label="Find a document by name"
              className="w-full rounded-xl border border-line-subtle bg-surface px-10 py-3 text-[13px] text-ink outline-none focus:border-brand"
            />
            {search ? (
              <button type="button" aria-label="Clear document search" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>

          {isLoading ? <LoadingState label="Loading documents" rows={3} /> : documents.length === 0 ? (
            <EmptyState
              icon={Files}
              title={search ? "No matching documents" : "Your vault is empty"}
              description={search ? "Try a different filename." : "Add a document to extract and search its text."}
              action={!search ? <Button variant="secondary" onClick={() => fileInput.current?.click()}>Add a document</Button> : undefined}
            />
          ) : (
            <div className="space-y-2">
              {documents.map((document) => (
                <button
                  type="button"
                  key={document.id}
                  onClick={() => selectDocument(document)}
                  aria-pressed={document.id === selectedId}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${document.id === selectedId ? "border-brand bg-brand-pale" : "border-line-subtle bg-surface hover:border-brand-light hover:bg-surface-muted"}`}
                >
                  <span className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{document.filename}</span>
                      <span className="mt-1 block text-[11px] text-ink-muted">
                        {formatSize(document.size_bytes)} · {document.chunk_count} passages · {new Date(document.created_at).toLocaleDateString()}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {selected ? (
          <section className="space-y-4">
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                  <div className="min-w-0">
                    <h2 className="break-words text-[15px] font-semibold text-ink">{selected.filename}</h2>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      {formatSize(selected.size_bytes)} · {selected.chunk_count} passages · SHA-256 {selected.sha256.slice(0, 12)}…
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void handleDownload(selected)}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete “${selected.filename}” and its extracted text?`)) deleteMutation.mutate(selected.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block min-w-48 space-y-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">Summary mode</span>
                  <select value={summaryMode} onChange={(event) => setSummaryMode(event.target.value)} aria-label="Summary mode" className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-xs text-ink">
                    {[["quick", "Quick"], ["executive", "Executive"], ["study", "Study"], ["research", "Research"], ["action", "Action items"], ["technical", "Technical"], ["critical", "Critical review"], ["custom", "Custom purpose"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                {summaryMode === "custom" ? <label className="block min-w-52 flex-1 space-y-1.5"><span className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">Custom purpose</span><input value={summaryPurpose} onChange={(event) => setSummaryPurpose(event.target.value)} maxLength={1000} placeholder="What should this summary focus on?" className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-xs text-ink" /></label> : null}
                <Button
                  variant="secondary"
                  loading={summaryMutation.isPending}
                  onClick={() => summaryMutation.mutate()}
                  disabled={!selected.chunk_count}
                >
                  <Sparkles className="h-4 w-4" /> Summarize with AI
                </Button>
                <span className="self-center text-[11px] text-ink-muted">Sends selected extracted passages, only after you request a summary.</span>
              </div>
              {selected.summary_text && !answer ? (
                <div className="mt-5 rounded-xl border border-line-subtle bg-surface-muted p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Saved summary · {selected.summary_model ?? "configured provider"}</p>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-secondary">{selected.summary_text}</p>
                </div>
              ) : null}
            </Card>

            <Card>
              <div className="border-b border-line-subtle px-5 py-4">
                <h2 className="text-[14px] font-semibold text-ink">Extracted text preview</h2>
                <p className="mt-1 text-[11px] text-ink-muted">Passage locators are retained. Original page rendering is available by downloading the file.</p>
              </div>
              <div className="max-h-[520px] space-y-3 overflow-y-auto p-5">
                {previewQuery.isLoading ? <LoadingState label="Loading document preview" rows={3} /> : (previewQuery.data?.passages ?? []).map((passage) => (
                  <article key={`${passage.ordinal}-${passage.locator}`} className="rounded-lg border border-line-subtle bg-surface-muted p-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-deep">{passage.locator}</p>
                    <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-secondary">{passage.text}</p>
                  </article>
                ))}
                {previewQuery.data?.total_passages && previewQuery.data.total_passages > 20 ? <p className="text-center text-[11px] text-ink-muted">Showing the first 20 of {previewQuery.data.total_passages} passages.</p> : null}
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-[14px] font-semibold text-ink">Ask this document</h2>
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (question.trim()) askMutation.mutate();
                }}
              >
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={1200}
                  placeholder="Ask about a detail in the document"
                  aria-label="Question about the selected document"
                  className="min-w-0 flex-1 rounded-xl border border-line-subtle bg-surface px-3.5 py-3 text-[13px] outline-none focus:border-brand"
                />
                <Button type="submit" loading={askMutation.isPending} disabled={!question.trim()}>Ask</Button>
              </form>
            </Card>

            {answer ? (
              <Card className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[14px] font-semibold text-ink">{answer.status === "SUMMARIZED" ? "Document summary" : "Answer"}</h2>
                  <Badge tone={answer.status === "AI_NOT_CONFIGURED" ? "warning" : "neutral"}>{answer.provider}</Badge>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">{answer.message}</p>
                {answer.artifact_id ? <a className="mt-2 inline-block text-xs font-medium text-brand hover:underline" href="/library">Open saved summary in Library</a> : null}
                {answer.answer ? <p className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{answer.answer}</p> : null}
                {answer.sources.length ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Source passages</p>
                    {answer.sources.map((source) => (
                      <blockquote key={source.reference} className="rounded-lg border-l-2 border-brand bg-surface-muted px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-brand-deep">[{source.reference}] · {source.locator}</p>
                        <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-secondary">{source.excerpt}</p>
                      </blockquote>
                    ))}
                  </div>
                ) : null}
              </Card>
            ) : null}
          </section>
        ) : (
          <Card className="flex min-h-64 items-center justify-center p-8 text-center">
            <div>
              <Files className="mx-auto h-7 w-7 text-ink-muted" />
              <p className="mt-3 text-[13px] font-medium text-ink">Select a document</p>
              <p className="mt-1 text-[12px] text-ink-muted">Its extracted passages and actions will appear here.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
