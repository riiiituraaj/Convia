"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Library, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/Toast";

export default function LibraryPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState("");
  const { data: artifacts = [], isLoading } = useQuery({
    queryKey: ["artifacts"],
    queryFn: () => api.getArtifacts(),
  });
  const { data: selected } = useQuery({
    queryKey: ["artifact", selectedId],
    queryFn: () => api.getArtifact(selectedId),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    const requestedId = window.location.hash.slice(1);
    if (requestedId && artifacts.some((item) => item.id === requestedId)) {
      if (selectedId !== requestedId) setSelectedId(requestedId);
      return;
    }
    if (!selectedId && artifacts.length) setSelectedId(artifacts[0].id);
    if (selectedId && !artifacts.some((item) => item.id === selectedId)) setSelectedId("");
  }, [artifacts, selectedId]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteArtifact(id),
    onSuccess: async (_, id) => {
      if (id === selectedId) setSelectedId("");
      await queryClient.invalidateQueries({ queryKey: ["artifacts"] });
      toast({ title: "Artifact deleted" });
    },
    onError: (error: Error) => toast({ title: "Could not delete artifact", description: error.message, tone: "danger" }),
  });

  const exportSelected = async () => {
    if (!selected) return;
    try {
      const blob = await api.downloadArtifact(selected.id, "markdown");
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${selected.title.replace(/[\\/:*?\"<>|]/g, "-").slice(0, 60)}.md`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Export failed", description: error instanceof Error ? error.message : undefined, tone: "danger" });
    }
  };

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Saved work"
        title="Library"
        description="Reopen research briefs and plans saved from your conversations and agent runs."
        icon={<Library className="h-5 w-5" strokeWidth={1.75} />}
      />

      {isLoading ? <LoadingState label="Loading saved artifacts" /> : artifacts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Your library is empty"
          description="Save a research session as an artifact or ask Agent Center to prepare a plan."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.5fr)]">
          <Card className="overflow-hidden">
            <div className="border-b border-line-subtle px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{artifacts.length} saved items</p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {artifacts.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  aria-current={selectedId === item.id ? "true" : undefined}
                  className={`mb-1 w-full rounded-lg p-3 text-left transition-colors ${selectedId === item.id ? "bg-brand-pale" : "hover:bg-surface-muted"}`}
                >
                  <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
                  <span className="mt-1 block text-xs text-ink-muted">{item.artifact_type.replaceAll("_", " ")} · v{item.version}</span>
                  {item.summary ? <span className="mt-1 block line-clamp-2 text-xs text-ink-secondary">{item.summary}</span> : null}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle px-5 py-4 sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-ink">{selected.title}</h2>
                      <Badge tone="neutral">{selected.artifact_type.replaceAll("_", " ")}</Badge>
                    </div>
                    {selected.summary ? <p className="mt-1 text-sm text-ink-secondary">{selected.summary}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportSelected}>
                      <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(selected.id)} disabled={deleteMutation.isPending}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
                <CardBody>
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-ink-secondary">{selected.content}</pre>
                  {selected.sources_json.length ? (
                    <div className="mt-6 border-t border-line-subtle pt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Sources</h3>
                      <ul className="mt-2 space-y-2">
                        {selected.sources_json.map((source, index) => (
                          <li key={`${source.url || source.id || "source"}-${index}`} className="text-sm">
                            {typeof source.url === "string" ? (
                              <a className="text-brand underline underline-offset-2" href={source.url} target="_blank" rel="noopener noreferrer">
                                {String(source.title || source.url)}
                              </a>
                            ) : <span className="text-ink-secondary">{String(source.title || "Source")}</span>}
                            {source.id ? <span className="ml-2 text-xs text-ink-muted">[{String(source.id)}]</span> : null}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-[11px] text-ink-muted">Source references point to stored research sources; they are not independent fact checks.</p>
                    </div>
                  ) : null}
                </CardBody>
              </>
            ) : <LoadingState label="Loading artifact" />}
          </Card>
        </div>
      )}
    </div>
  );
}
