"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Search,
  Target,
  CheckCircle2,
  Users,
  ShieldAlert,
  Brain,
  ArrowRight,
  Globe2,
  ExternalLink,
  FileText,
  Sparkles,
  BookmarkPlus,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type ResearchPayload = Awaited<ReturnType<typeof api.runResearch>>;

const SECTION_ICONS = {
  missions: Target,
  commitments: CheckCircle2,
  people: Users,
  risks: ShieldAlert,
  memories: Brain,
} as const;

type SearchResultType = "missions" | "commitments" | "people" | "risks" | "memories";

interface SearchResult {
  type: SearchResultType;
  title: string;
  subtitle: string;
  meta: string;
  data: any;
  timestamp: string;
  href: string;
}

const resultHref = (type: SearchResultType, data: any): string => {
  switch (type) {
    case "missions":
      return data?.id ? `/missions/${data.id}` : "/missions";
    case "commitments":
      return "/commitments";
    case "people":
      return "/people";
    case "risks":
      return "/risks";
    case "memories":
      return "/memory";
    default:
      return "/search";
  }
};

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [research, setResearch] = useState<ResearchPayload | null>(null);
  const { toast } = useToast();

  const { data: missions = [] } = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.getMissions(),
  });

  const { data: commitments = [] } = useQuery({
    queryKey: ["commitments"],
    queryFn: () => api.getCommitments("ALL"),
  });

  const { data: memories = [] } = useQuery({
    queryKey: ["memory"],
    queryFn: () => api.getMemories(),
  });

  const { data: people = [] } = useQuery({
    queryKey: ["people"],
    queryFn: () => api.getPeople(),
  });

  const { data: risks = [] } = useQuery({
    queryKey: ["risks"],
    queryFn: () => api.getRisks(),
  });

  const researchMutation = useMutation({
    mutationFn: (q: string) => api.runResearch(q),
    onSuccess: (data) => setResearch(data),
    onError: () =>
      toast({
        title: "Web research failed",
        description: "Could not reach the research endpoint.",
        tone: "danger",
      }),
  });

  const toArtifactMutation = useMutation({
    mutationFn: (sessionId: string) => api.convertResearchToArtifact(sessionId),
    onSuccess: (data) =>
      toast({
        title: "Saved as Artifact",
        description: `Deliverable artifact created: ${data.title}`,
        tone: "success",
      }),
    onError: () =>
      toast({
        title: "Conversion failed",
        description: "Could not convert research session into an artifact.",
        tone: "danger",
      }),
  });

  const toMissionMutation = useMutation({
    mutationFn: (sessionId: string) => api.convertResearchToMission(sessionId),
    onSuccess: (data) =>
      toast({
        title: "Converted to Mission",
        description: `New mission created: ${data.title}`,
        tone: "success",
      }),
    onError: () =>
      toast({
        title: "Conversion failed",
        description: "Could not convert research session into a mission.",
        tone: "danger",
      }),
  });

  const performSearch = React.useCallback(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const term = query.trim().toLowerCase();
    const found: SearchResult[] = [];

    // Search missions
    missions
      .filter((m) =>
        m.title.toLowerCase().includes(term) ||
        m.description?.toLowerCase().includes(term) ||
        m.desired_outcome?.toLowerCase().includes(term)
      )
      .forEach((m) => {
        found.push({
          type: "missions",
          title: m.title,
          subtitle: m.desired_outcome || m.description || "Mission",
          meta: `${m.progress}% complete · ${m.status}`,
          data: m,
          timestamp: m.updated_at,
          href: resultHref("missions", m),
        });
      });

    // Search commitments
    commitments
      .filter((c) =>
        c.action.toLowerCase().includes(term) ||
        c.recipient?.toLowerCase().includes(term) ||
        c.context?.toLowerCase().includes(term) ||
        c.consequences?.toLowerCase().includes(term)
      )
      .forEach((c) => {
        found.push({
          type: "commitments",
          title: c.action,
          subtitle: c.recipient ? `Owed to ${c.recipient}` : "Self commitment",
          meta: `${c.status} · ${c.risk_level} risk`,
          data: c,
          timestamp: c.updated_at,
          href: resultHref("commitments", c),
        });
      });

    // Search people
    people
      .filter((p) =>
        p.name.toLowerCase().includes(term) ||
        p.waiting_on_user.some((w) => w.action.toLowerCase().includes(term)) ||
        p.user_waiting_on.some((w) => w.action.toLowerCase().includes(term))
      )
      .forEach((p) => {
        found.push({
          type: "people",
          title: p.name,
          subtitle: `${p.open_commitments} open commitments`,
          meta: p.waiting_on_user.length > 0 ? "Recipient on active commitment" : "No active recipient record",
          data: p,
          timestamp: p.last_interaction,
          href: resultHref("people", p),
        });
      });

    // Search memories
    memories
      .filter((m) => m.content.toLowerCase().includes(term))
      .forEach((m) => {
        found.push({
          type: "memories",
          title: m.content.slice(0, 80) + (m.content.length > 80 ? "…" : ""),
          subtitle: m.category,
          meta: `Memory · ${m.category}`,
          data: m,
          timestamp: m.created_at,
          href: resultHref("memories", m),
        });
      });

    // Search risks
    risks
      .filter((r) =>
        r.title.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term)
      )
      .forEach((r) => {
        found.push({
          type: "risks",
          title: r.title,
          subtitle: r.description.slice(0, 80) + (r.description.length > 80 ? "…" : ""),
          meta: `${r.severity} · ${Math.round(r.score * 100)}%`,
          data: r,
          timestamp: r.updated_at,
          href: resultHref("risks", r),
        });
      });

    // Sort by relevance (exact matches first) then by recency
    found.sort((a, b) => {
      const aExact = a.title.toLowerCase() === term || a.subtitle.toLowerCase() === term;
      const bExact = b.title.toLowerCase() === term || b.subtitle.toLowerCase() === term;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    setResults(found);
    setIsSearching(false);
  }, [query, missions, commitments, memories, people, risks]);

  React.useEffect(() => {
    const debounce = setTimeout(performSearch, 150);
    return () => clearTimeout(debounce);
  }, [query, performSearch]);

  React.useEffect(() => {
    setResearch(null);
  }, [query]);

  const groupedResults = React.useMemo(() => {
    const groups: Record<SearchResultType, SearchResult[]> = {
      missions: [],
      commitments: [],
      people: [],
      risks: [],
      memories: [],
    };
    results.forEach((r) => groups[r.type].push(r));
    return groups;
  }, [results]);

  const totalResults = results.length;

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Workspace search"
        title="Search CONVIA"
        description="Search saved missions, commitments, people, risks, and memories, or run a separate optional web research query."
        icon={<Search className="h-5 w-5" strokeWidth={1.75} />}
      />

      <Card className="p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-muted" strokeWidth={1.8} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={'Search: "What did I promise Rahul?" or "Bangalore flights" or "at risk"...'}
            className="w-full pl-10 pr-4 py-3.5 text-[14px] bg-surface-muted border border-line-subtle rounded-xl outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            autoFocus
          />
        </div>
        {query && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12.5px] text-ink-secondary">
              {isSearching ? "Searching…" : `${totalResults} result${totalResults === 1 ? "" : "s"}`}
            </span>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => researchMutation.mutate(query.trim())}
                loading={researchMutation.isPending}
              >
                <Globe2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                Research web
              </Button>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResearch(null);
                }}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-secondary hover:text-ink"
              >
                <span>Clear</span>
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {research && (
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-brand" strokeWidth={1.75} />
              <h2 className="text-[14px] font-semibold text-ink">Web research</h2>
            </div>
            <Badge tone={research.success ? "success" : "warning"} dot>
              {research.success ? "Tavily request completed" : "Unavailable · no live sources"}
            </Badge>
          </div>
          {research.answer ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Tavily summary</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{research.answer}</p>
            </div>
          ) : null}
          {research.error ? (
            <p className="mt-2 text-[12.5px] text-warning">{research.error}</p>
          ) : null}
          <div className="mt-4 space-y-3">
            {research.results.map((item) => {
              const offline = !item.url;
              const body = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-ink truncate">{item.title}</p>
                      <p className="mt-0.5 text-[12px] text-ink-secondary line-clamp-2">
                        {item.snippet}
                      </p>
                      <p className="mt-1.5 text-[11px] text-ink-muted">
                        [{item.id}] {item.domain || "web source"}
                        {item.relevance != null ? ` · relevance ${Math.round(item.relevance * 100)}%` : ""}
                        {item.published_at ? ` · published ${item.published_at}` : ""}
                      </p>
                    </div>
                    {!offline ? (
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={1.8} />
                    ) : null}
                  </div>
                </>
              );
              if (offline) {
                return (
                  <div
                    key={item.title}
                    className="block rounded-xl border border-dashed border-line bg-surface-muted p-3.5"
                  >
                    {body}
                  </div>
                );
              }
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-line-subtle bg-surface-muted p-3.5 transition-colors hover:border-brand hover:bg-brand-pale"
                >
                  {body}
                </a>
              );
            })}
          </div>
          {research.evidence?.length ? (
            <div className="mt-4 border-l-2 border-brand pl-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Evidence
              </p>
              <ul className="mt-1.5 space-y-1">
                {research.evidence.map((line) => (
                  <li key={line} className="text-[12px] leading-relaxed text-ink-secondary">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {research.synthesis ? (
            <div className="mt-5 rounded-xl border border-brand/20 bg-brand-pale/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
                <Sparkles className="h-4 w-4" /> Source-linked synthesis
              </div>
              <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink">
                {research.synthesis}
              </div>
              <p className="mt-2 text-[11px] text-ink-muted">
                Citation IDs are checked against retrieved sources; source support is not independently fact-checked.
              </p>
            </div>
          ) : null}

          {research.session_id ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => toArtifactMutation.mutate(research.session_id)}
                disabled={toArtifactMutation.isPending}
              >
                {toArtifactMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
                Save as Artifact
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toMissionMutation.mutate(research.session_id)}
                disabled={toMissionMutation.isPending}
              >
                {toMissionMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Target className="mr-1.5 h-3.5 w-3.5" />}
                Convert to Mission
              </Button>
            </div>
          ) : null}
        </Card>
      )}

      {query && !isSearching && totalResults === 0 && (
        <EmptyState
          icon={Search}
          title="No results found"
          description="Try different keywords or check your spelling."
        />
      )}

      {query && !isSearching && totalResults > 0 && (
        <div className="space-y-6">
          {(Object.entries(groupedResults) as [SearchResultType, SearchResult[]][]).map(([type, items]) => {
            if (items.length === 0) return null;
            const Icon = SECTION_ICONS[type];
            return (
              <section key={type} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-brand" strokeWidth={1.75} />
                    <h2 className="text-[14px] font-semibold text-ink capitalize">{type}</h2>
                  </div>
                  <Badge tone="neutral">{items.length}</Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {items.slice(0, 10).map((item, index) => (
                    <Card
                      key={`${type}-${index}`}
                      interactive
                      className="p-4 cursor-pointer"
                      onClick={() => router.push(item.href)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[13.5px] font-semibold text-ink truncate">{item.title}</h3>
                          <p className="mt-0.5 text-[12px] text-ink-secondary">{item.subtitle}</p>
                          <p className="mt-1.5 text-[11px] text-ink-muted">{item.meta}</p>
                        </div>
                        <Badge tone="brand" size="sm">Open</Badge>
                      </div>
                    </Card>
                  ))}
                  {items.length > 10 && (
                    <Card className="p-4 text-center text-[12.5px] text-ink-secondary">
                      +{items.length - 10} more results
                    </Card>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!query && (
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { q: "What did I promise Rahul?", desc: "Find commitments by person" },
                { q: "Everything at risk", desc: "Show all at-risk commitments" },
                { q: "Bangalore", desc: "Mission-related content" },
                { q: "API tonight", desc: "Time-sensitive commitments" },
                { q: "budget", desc: "Budget constraints and risks" },
                { q: "waiting on", desc: "Search saved recipients and dependencies" },
              ].map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setQuery(suggestion.q)}
                  className="p-4 rounded-xl border border-line-subtle bg-surface-muted hover:border-brand hover:bg-brand-pale transition-colors text-left"
                >
                  <p className="text-[13.5px] font-medium text-ink">{suggestion.q}</p>
                  <p className="mt-1 text-[12px] text-ink-secondary">{suggestion.desc}</p>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
