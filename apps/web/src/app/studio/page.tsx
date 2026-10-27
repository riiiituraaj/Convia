"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, BriefcaseBusiness, FileText, Layers3, Library, ListChecks, Play, Save, Search, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ContextPackItem, KnowledgeEntryItem, PlaybookItem } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

type Section = "tools" | "packs" | "knowledge" | "playbooks" | "briefing";
type Tool = "meeting" | "decision" | "explain" | "writing" | "learning" | "project_plan" | "spreadsheet" | "compare";
type PlaybookStep = { title: string; action: string };
type MeetingAction = { text: string; owner?: string | null; deadline?: string | null; evidence: string };

const SECTIONS: Array<{ id: Section; label: string; icon: typeof Sparkles }> = [
  { id: "tools", label: "Studio", icon: Sparkles },
  { id: "packs", label: "Context Packs", icon: Layers3 },
  { id: "knowledge", label: "Knowledge Vault", icon: Library },
  { id: "playbooks", label: "Playbooks", icon: ListChecks },
  { id: "briefing", label: "Briefing", icon: BriefcaseBusiness },
];

const TOOL_LABELS: Record<Tool, string> = {
  meeting: "Meeting to actions",
  decision: "Decision Lab",
  explain: "Explain anything",
  writing: "Writing workshop",
  learning: "Learning companion",
  project_plan: "Project autopilot plan",
  spreadsheet: "Spreadsheet analysis",
  compare: "Compare documents",
};

const textareaClass = "min-h-36 w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted focus:border-brand-accent focus:outline-none focus:shadow-focus";

export default function StudioPage() {
  const [section, setSection] = useState<Section>("tools");
  const [tool, setTool] = useState<Tool>("meeting");
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [context, setContext] = useState("");
  const [decisionJson, setDecisionJson] = useState('{"criteria":[{"name":"Cost","weight":2},{"name":"Flexibility","weight":1}],"options":[{"name":"Option A","scores":{"Cost":8,"Flexibility":6}},{"name":"Option B","scores":{"Cost":5,"Flexibility":9}}]}');
  const [csvText, setCsvText] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [packTitle, setPackTitle] = useState("");
  const [packObjective, setPackObjective] = useState("");
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeText, setKnowledgeText] = useState("");
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [playbookName, setPlaybookName] = useState("");
  const [playbookDescription, setPlaybookDescription] = useState("");
  const [playbookRequests, setPlaybookRequests] = useState<Record<string, string>>({});
  const [playbookSteps, setPlaybookSteps] = useState<PlaybookStep[]>([{ title: "Find relevant source material", action: "search_documents" }]);
  const [output, setOutput] = useState("");
  const [meetingArtifactId, setMeetingArtifactId] = useState("");
  const [meetingActions, setMeetingActions] = useState<MeetingAction[]>([]);
  const [selectedMeetingActions, setSelectedMeetingActions] = useState<number[]>([]);
  const [meetingMissionTitle, setMeetingMissionTitle] = useState("");
  const [missionCreated, setMissionCreated] = useState("");
  const [resumedContext, setResumedContext] = useState("");
  const [runInfo, setRunInfo] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const docsQuery = useQuery({ queryKey: ["documents"], queryFn: () => api.getDocuments() });
  const packsQuery = useQuery({ queryKey: ["context-packs"], queryFn: () => api.getContextPacks(), enabled: section === "packs" });
  const knowledgeQuery = useQuery({ queryKey: ["knowledge", knowledgeSearch], queryFn: () => api.getKnowledge(knowledgeSearch), enabled: section === "knowledge" });
  const playbooksQuery = useQuery({ queryKey: ["playbooks"], queryFn: () => api.getPlaybooks(), enabled: section === "playbooks" });
  const briefingQuery = useQuery({ queryKey: ["briefing"], queryFn: () => api.getBriefing(), enabled: section === "briefing" });
  const documents = docsQuery.data ?? [];

  const runMutation = useMutation({
    mutationFn: async () => {
      if (tool === "spreadsheet") {
        if (selectedDocs.length === 1) return api.analyzeSpreadsheetDocument(selectedDocs[0]);
        return api.analyzeSpreadsheet(title || "pasted-data.csv", csvText);
      }
      if (tool === "compare") {
        if (selectedDocs.length < 2) throw new Error("Choose at least two documents to compare.");
        return api.compareDocuments(selectedDocs);
      }
      let options: Record<string, unknown> = {};
      if (tool === "decision") {
        try { options = JSON.parse(decisionJson) as Record<string, unknown>; }
        catch { throw new Error("Decision criteria must be valid JSON."); }
      }
      return api.runStudio({
        task_type: tool,
        title: title || TOOL_LABELS[tool],
        text: sourceText,
        context,
        options,
      });
    },
    onSuccess: async (result) => {
      setOutput(JSON.stringify(result, null, 2));
      setMeetingActions([]); setMeetingArtifactId(""); setSelectedMeetingActions([]); setMissionCreated("");
      if (tool === "meeting" && "content" in result && typeof result.content === "string" && typeof result.artifact_id === "string") {
        try {
          const meeting = JSON.parse(result.content) as { actions?: MeetingAction[] };
          if (Array.isArray(meeting.actions)) { setMeetingActions(meeting.actions); setMeetingArtifactId(result.artifact_id); setMeetingMissionTitle(`${title || "Meeting"} action items`); }
        } catch { /* The saved JSON remains visible for review. */ }
      }
      await queryClient.invalidateQueries({ queryKey: ["artifacts"] });
      const saved = typeof result === "object" && result !== null && "artifact_id" in result;
      toast({ title: "Studio output ready", description: saved ? "The result and its source details are saved in your Library." : "No artifact was saved because this workflow did not produce an answer." });
    },
    onError: (error: Error) => toast({ title: "Could not complete this workflow", description: error.message, tone: "danger" }),
  });

  const createPack = useMutation({
    mutationFn: () => api.createContextPack({
      title: packTitle,
      objective: packObjective,
      resource_refs_json: selectedDocs.length ? { documents: selectedDocs } : {},
    }),
    onSuccess: async () => {
      setPackTitle(""); setPackObjective(""); setSelectedDocs([]);
      await queryClient.invalidateQueries({ queryKey: ["context-packs"] });
      toast({ title: "Context Pack saved", description: "You can reopen it to load its attached records." });
    },
    onError: (error: Error) => toast({ title: "Could not save Context Pack", description: error.message, tone: "danger" }),
  });

  const createKnowledge = useMutation({
    mutationFn: () => api.createKnowledge({ title: knowledgeTitle, content: knowledgeText, entry_type: "NOTE", collection: "General" }),
    onSuccess: async () => {
      setKnowledgeTitle(""); setKnowledgeText("");
      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      toast({ title: "Saved to Knowledge Vault" });
    },
    onError: (error: Error) => toast({ title: "Could not save note", description: error.message, tone: "danger" }),
  });

  const createPlaybook = useMutation({
    mutationFn: () => api.createPlaybook({ name: playbookName, description: playbookDescription, inputs_json: [{ name: "request", description: "What should this run accomplish?", required: true }], steps_json: playbookSteps }),
    onSuccess: async () => {
      setPlaybookName(""); setPlaybookDescription("");
      await queryClient.invalidateQueries({ queryKey: ["playbooks"] });
      toast({ title: "Playbook saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save playbook", description: error.message, tone: "danger" }),
  });

  const deletePack = useMutation({ mutationFn: (id: string) => api.deleteContextPack(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["context-packs"] }) });
  const deleteKnowledge = useMutation({ mutationFn: (id: string) => api.deleteKnowledge(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }) });
  const deletePlaybook = useMutation({ mutationFn: (id: string) => api.deletePlaybook(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playbooks"] }) });
  const updatePack = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ContextPackItem> }) => api.updateContextPack(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["context-packs"] }),
    onError: (error: Error) => toast({ title: "Could not update Context Pack", description: error.message, tone: "danger" }),
  });
  const updateKnowledge = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<KnowledgeEntryItem> }) => api.updateKnowledge(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
    onError: (error: Error) => toast({ title: "Could not update saved knowledge", description: error.message, tone: "danger" }),
  });
  const updatePlaybook = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PlaybookItem> }) => api.updatePlaybook(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playbooks"] }),
    onError: (error: Error) => toast({ title: "Could not update playbook", description: error.message, tone: "danger" }),
  });
  const resumePack = useMutation({
    mutationFn: (id: string) => api.resumeContextPack(id),
    onSuccess: (result) => setResumedContext(JSON.stringify(result, null, 2)),
    onError: (error: Error) => toast({ title: "Could not reopen Context Pack", description: error.message, tone: "danger" }),
  });
  const playbookRun = useMutation({
    mutationFn: ({ id, request }: { id: string; request: string }) => api.runPlaybook(id, { user_request: request }),
    onSuccess: (result) => setRunInfo(JSON.stringify({ status: result.status, run_id: result.agent_run.id, steps: result.agent_run.steps, message: result.message }, null, 2)),
    onError: (error: Error) => toast({ title: "Playbook run failed", description: error.message, tone: "danger" }),
  });
  const meetingConversion = useMutation({
    mutationFn: () => api.createMissionFromMeeting(meetingArtifactId, meetingMissionTitle, selectedMeetingActions),
    onSuccess: async (result) => {
      setMissionCreated(`${result.title}: ${result.commitments_created} planned commitment(s) created.`);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["missions"] }), queryClient.invalidateQueries({ queryKey: ["commitments"] })]);
      toast({ title: "Meeting actions added to CONVIA", description: "They are saved as planned commitments with their supporting excerpts." });
    },
    onError: (error: Error) => toast({ title: "Could not add meeting actions", description: error.message, tone: "danger" }),
  });

  const toggleDocument = (id: string) => setSelectedDocs((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Your working memory"
        title="Studio & Knowledge"
        description="Turn source material into useful drafts, keep project context together, and reuse workflows with honest execution status."
        icon={<Sparkles className="h-5 w-5" strokeWidth={1.8} />}
        meta={<><Badge tone="brand" dot>Account scoped</Badge><Badge tone="neutral">Generated work is saved to Library</Badge></>}
      />

      <div className="flex gap-2 overflow-x-auto border-b border-line-subtle pb-2" role="tablist" aria-label="Studio sections">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setSection(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition ${section === id ? "bg-brand-pale text-brand-deep" : "text-ink-secondary hover:bg-surface-sunken"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {section === "tools" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3"><span className="rounded-lg bg-brand-pale p-2 text-brand"><Sparkles className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-ink">Start a workflow</h2><p className="mt-1 text-xs leading-relaxed text-ink-secondary">AI workflows use your configured provider. Uploaded source text is sent only when you submit it here.</p></div></div>
            <div className="space-y-4">
              <Field label="Capability"><Select value={tool} onChange={(event) => { setTool(event.target.value as Tool); setOutput(""); }}>
                {Object.entries(TOOL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select></Field>
              <Field label="Output title"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={TOOL_LABELS[tool]} /></Field>
              {tool === "spreadsheet" ? <>
                <Field label="Use an uploaded spreadsheet" hint="Choose one of your CSV or XLSX files; values are analyzed on this server without executing workbook code.">
                  <Select value={selectedDocs.length === 1 ? selectedDocs[0] : ""} onChange={(event) => setSelectedDocs(event.target.value ? [event.target.value] : [])}>
                    <option value="">Paste CSV below</option>
                    {documents.filter((document) => [".csv", ".xlsx"].includes(document.extension)).map((document) => <option key={document.id} value={document.id}>{document.filename}</option>)}
                  </Select>
                </Field>
                {!selectedDocs.length ? <Field label="CSV data"><Textarea className={`${textareaClass} min-h-48 font-mono text-xs`} value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder={'product,units,revenue\nAlpha,12,480\nBeta,9,315'} /></Field> : null}
              </> : null}
              {tool === "compare" ? <div className="space-y-2"><p className="text-[12px] font-medium uppercase tracking-wide text-ink-secondary">Choose 2–5 documents</p><DocumentPicker documents={documents} selected={selectedDocs} onToggle={toggleDocument} /></div> : null}
              {tool !== "spreadsheet" && tool !== "compare" ? <>
                <Field label={tool === "meeting" ? "Meeting notes or transcript" : tool === "project_plan" ? "Project objective" : tool === "decision" ? "Decision context" : "Source text or request"}>
                  <Textarea className={textareaClass} value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder={tool === "meeting" ? "Paste notes or a transcript. Explicitly named owners and dates are retained with supporting excerpts." : "Add the text or describe what you want CONVIA to do."} />
                </Field>
                {tool === "decision" ? <Field label="Options and weighted criteria (JSON)" hint="Score each option from 0 to 10. The result uses these inputs only; it does not verify them."><Textarea className={`${textareaClass} min-h-48 font-mono text-xs`} value={decisionJson} onChange={(event) => setDecisionJson(event.target.value)} /></Field> : null}
                {!["meeting", "decision"].includes(tool) ? <Field label="Audience, tone, constraints, or learning goals"><Textarea className="min-h-24 w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand-accent focus:outline-none" value={context} onChange={(event) => setContext(event.target.value)} placeholder="Optional guidance. Keep facts grounded in the source text." /></Field> : null}
              </> : null}
              <Button onClick={() => runMutation.mutate()} loading={runMutation.isPending} className="w-full"><Sparkles className="h-4 w-4" />Run {TOOL_LABELS[tool]}</Button>
            </div>
          </Card>

          <Card className="min-h-[420px] overflow-hidden">
            <CardHeader title="Output" subtitle="Generated drafts, calculations, and source records appear here." icon={<FileText className="h-4 w-4" />} action={output ? <a href="/library" className="text-xs font-medium text-brand hover:underline">Open Library</a> : undefined} />
            <CardBody>
              {runMutation.isPending ? <LoadingState label="Preparing your output" rows={4} /> : output ? <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-sunken p-4 font-mono text-xs leading-relaxed text-ink-secondary">{output}</pre> : <EmptyState icon={Sparkles} title="Your workspace is ready" description="Choose a capability and provide the source material or context it needs." />}
              {meetingActions.length ? <div className="mt-5 rounded-xl border border-brand-light bg-brand-pale p-4"><h3 className="text-sm font-semibold text-ink">Review extracted actions</h3><p className="mt-1 text-xs text-ink-secondary">Select only the tasks you want saved. Each selected task must retain a verbatim excerpt from the meeting notes.</p><div className="mt-3 space-y-2">{meetingActions.map((action, index) => <label key={`${index}-${action.text}`} className="flex items-start gap-2 rounded-lg border border-line-subtle bg-surface p-3 text-xs"><input type="checkbox" checked={selectedMeetingActions.includes(index)} onChange={() => setSelectedMeetingActions((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])} /><span><span className="block font-medium text-ink">{action.text}</span><span className="mt-1 block text-ink-muted">{action.owner ? `Owner: ${action.owner}` : "No explicit owner"}{action.deadline ? ` · Deadline: ${action.deadline}` : " · No explicit deadline"}</span><span className="mt-1 block text-ink-muted">Evidence: “{action.evidence}”</span></span></label>)}</div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={meetingMissionTitle} onChange={(event) => setMeetingMissionTitle(event.target.value)} aria-label="Mission title for meeting actions" placeholder="Meeting follow-ups" /><Button size="sm" onClick={() => meetingConversion.mutate()} loading={meetingConversion.isPending} disabled={!selectedMeetingActions.length || !meetingMissionTitle.trim()}>Add selected tasks to Missions</Button></div>{missionCreated ? <p className="mt-2 text-xs font-medium text-brand-deep">{missionCreated}</p> : null}</div> : null}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {section === "packs" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
          <Card className="p-5 sm:p-6"><h2 className="text-sm font-semibold text-ink">Create a Context Pack</h2><p className="mt-1 text-xs leading-relaxed text-ink-secondary">A focused bundle for one project, trip, course, or application. Only records you attach are loaded when you resume it.</p>
            <div className="mt-4 space-y-4"><Field label="Pack name"><Input value={packTitle} onChange={(event) => setPackTitle(event.target.value)} placeholder="Autumn research project" /></Field><Field label="Goal and constraints"><Textarea className={textareaClass} value={packObjective} onChange={(event) => setPackObjective(event.target.value)} placeholder="What are you working toward? Add constraints or open questions." /></Field>
              <div><p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink-secondary">Attach documents</p><DocumentPicker documents={documents} selected={selectedDocs} onToggle={toggleDocument} /></div>
              <Button onClick={() => createPack.mutate()} loading={createPack.isPending} disabled={!packTitle.trim()}><Save className="h-4 w-4" />Save pack</Button></div>
          </Card>
          <div className="space-y-4"><Card><CardHeader title="Your Context Packs" subtitle="Saved goal, constraints, questions, and attached records." icon={<Layers3 className="h-4 w-4" />} />
            <CardBody>{packsQuery.isLoading ? <LoadingState label="Loading Context Packs" rows={3} /> : (packsQuery.data ?? []).length ? <div className="space-y-2">{(packsQuery.data ?? []).map((pack) => <ContextPackRow key={pack.id} pack={pack} onResume={() => resumePack.mutate(pack.id)} onUpdate={(payload) => updatePack.mutate({ id: pack.id, payload })} onDelete={() => deletePack.mutate(pack.id)} />)}</div> : <EmptyState icon={Layers3} title="No Context Packs yet" description="Create one to keep a focused set of project context together." />}</CardBody>
          </Card>{resumedContext ? <Card><CardHeader title="Resumed pack context" subtitle="Current attached records are included with their provenance." /><CardBody><pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-ink-secondary">{resumedContext}</pre></CardBody></Card> : null}</div>
        </div>
      ) : null}

      {section === "knowledge" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
          <Card className="p-5 sm:p-6"><h2 className="text-sm font-semibold text-ink">Save a note or finding</h2><p className="mt-1 text-xs leading-relaxed text-ink-secondary">Knowledge is saved only when you submit this form. Edit or remove saved entries at any time.</p>
            <div className="mt-4 space-y-4"><Field label="Title"><Input value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} placeholder="Decision: use the smaller dataset" /></Field><Field label="Content"><Textarea className={textareaClass} value={knowledgeText} onChange={(event) => setKnowledgeText(event.target.value)} placeholder="Record the information and where it came from." /></Field><Button onClick={() => createKnowledge.mutate()} loading={createKnowledge.isPending} disabled={!knowledgeTitle.trim() || !knowledgeText.trim()}><Save className="h-4 w-4" />Save to Vault</Button></div>
          </Card>
          <Card><CardHeader title="Saved knowledge" subtitle="Search only your account's notes, findings, decisions, and definitions." icon={<Library className="h-4 w-4" />} />
            <CardBody><label className="relative mb-4 block"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-muted" /><Input className="pl-10" value={knowledgeSearch} onChange={(event) => setKnowledgeSearch(event.target.value)} placeholder="Search saved knowledge" aria-label="Search saved knowledge" /></label>
              {knowledgeQuery.isLoading ? <LoadingState label="Searching knowledge" rows={3} /> : (knowledgeQuery.data ?? []).length ? <div className="space-y-3">{(knowledgeQuery.data ?? []).map((entry) => <KnowledgeRow key={entry.id} entry={entry} onUpdate={(payload) => updateKnowledge.mutate({ id: entry.id, payload })} onDelete={() => deleteKnowledge.mutate(entry.id)} />)}</div> : <EmptyState icon={BookOpen} title="No saved knowledge found" description="Save a note or finding when you want it available for future work." />}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {section === "playbooks" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
          <Card className="p-5 sm:p-6"><h2 className="text-sm font-semibold text-ink">Design a reusable playbook</h2><p className="mt-1 text-xs leading-relaxed text-ink-secondary">A playbook describes a bounded workflow. Running it creates a persisted agent run that reports actual tool outcomes and blockers.</p>
            <div className="mt-4 space-y-4"><Field label="Name"><Input value={playbookName} onChange={(event) => setPlaybookName(event.target.value)} placeholder="Research and prepare a brief" /></Field><Field label="Purpose"><Textarea className="min-h-20 w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm" value={playbookDescription} onChange={(event) => setPlaybookDescription(event.target.value)} /></Field>
                <div className="space-y-2"><p className="text-[12px] font-medium uppercase tracking-wide text-ink-secondary">Registered tool steps</p>{playbookSteps.map((step, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_200px]"><Input aria-label={`Playbook step ${index + 1}`} value={step.title} onChange={(event) => setPlaybookSteps((items) => items.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} /><Select aria-label={`Action for step ${index + 1}`} value={step.action} onChange={(event) => setPlaybookSteps((items) => items.map((item, i) => i === index ? { ...item, action: event.target.value } : item))}>{["tavily_search", "document_vault_search", "document_qa", "mission_task_create", "artifact_save", "action_request_approval"].map((action) => <option key={action} value={action}>{action.replaceAll("_", " ")}</option>)}</Select></div>)}
                <Button size="sm" variant="outline" onClick={() => setPlaybookSteps((items) => [...items, { title: "New workflow step", action: "artifact_save" }])} disabled={playbookSteps.length >= 12}>Add step</Button></div>
              <Button onClick={() => createPlaybook.mutate()} loading={createPlaybook.isPending} disabled={!playbookName.trim()}><Save className="h-4 w-4" />Save playbook</Button>
            </div>
          </Card>
          <div className="space-y-4"><Card><CardHeader title="Saved Playbooks" subtitle="Editable, account-owned workflow templates." icon={<ListChecks className="h-4 w-4" />} /><CardBody>
            {playbooksQuery.isLoading ? <LoadingState label="Loading playbooks" rows={3} /> : (playbooksQuery.data ?? []).length ? <div className="space-y-3">{(playbooksQuery.data ?? []).map((book) => <PlaybookRow key={book.id} book={book} request={playbookRequests[book.id] ?? ""} onRequest={(value) => setPlaybookRequests((current) => ({ ...current, [book.id]: value }))} onRun={() => playbookRun.mutate({ id: book.id, request: playbookRequests[book.id] ?? "" })} running={playbookRun.isPending} onUpdate={(payload) => updatePlaybook.mutate({ id: book.id, payload })} onDelete={() => deletePlaybook.mutate(book.id)} />)}</div> : <EmptyState icon={ListChecks} title="No playbooks saved" description="Define a workflow once and run it again with a new request." />}
          </CardBody></Card>{runInfo ? <Card><CardHeader title="Latest agent run" subtitle="This status comes from persisted run and step records." /><CardBody><pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-ink-secondary">{runInfo}</pre></CardBody></Card> : null}</div>
        </div>
      ) : null}

      {section === "briefing" ? <Card><CardHeader title="Personal briefing" subtitle="A current view of records you have actually saved. Scheduling and external notifications are not enabled." icon={<BriefcaseBusiness className="h-4 w-4" />} /><CardBody>{briefingQuery.isLoading ? <LoadingState label="Preparing your briefing" rows={4} /> : <pre className="overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-ink-secondary">{JSON.stringify(briefingQuery.data ?? {}, null, 2)}</pre>}</CardBody></Card> : null}
    </div>
  );
}

function DocumentPicker({ documents, selected, onToggle }: { documents: Array<{ id: string; filename: string; extension: string }>; selected: string[]; onToggle: (id: string) => void }) {
  if (!documents.length) return <p className="rounded-lg bg-surface-sunken p-3 text-xs text-ink-muted">Upload documents first to attach or compare them.</p>;
  return <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line-subtle p-2">{documents.map((document) => <label key={document.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-ink-secondary hover:bg-surface-sunken"><input type="checkbox" checked={selected.includes(document.id)} onChange={() => onToggle(document.id)} /><span className="min-w-0 truncate">{document.filename}</span><span className="ml-auto text-[10px] text-ink-muted">{document.extension}</span></label>)}</div>;
}

function ContextPackRow({ pack, onResume, onUpdate, onDelete }: { pack: ContextPackItem; onResume: () => void; onUpdate: (payload: Partial<ContextPackItem>) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(pack.title);
  const [objective, setObjective] = useState(pack.objective);
  const refCount = Object.values(pack.resource_refs_json ?? {}).reduce((total, values) => total + values.length, 0);
  return <article className="rounded-lg border border-line-subtle p-3"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{pack.title}</p><p className="mt-1 line-clamp-2 text-xs text-ink-secondary">{pack.objective || "No objective added"}</p><p className="mt-1 text-[11px] text-ink-muted">{refCount} linked record{refCount === 1 ? "" : "s"} · {pack.status.toLowerCase()}</p></div><Button size="sm" variant="secondary" onClick={onResume}>Resume</Button><button aria-label={`Delete ${pack.title}`} onClick={onDelete} className="rounded p-2 text-ink-muted hover:bg-danger-light hover:text-danger"><Trash2 className="h-4 w-4" /></button></div><details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-brand">Edit pack</summary><div className="mt-3 grid gap-2 sm:grid-cols-2"><Input aria-label="Context Pack title" value={title} onChange={(event) => setTitle(event.target.value)} /><Input aria-label="Context Pack objective" value={objective} onChange={(event) => setObjective(event.target.value)} /><Button size="sm" className="sm:col-span-2 sm:justify-self-start" onClick={() => onUpdate({ title, objective })}>Save changes</Button></div></details></article>;
}

function KnowledgeRow({ entry, onUpdate, onDelete }: { entry: KnowledgeEntryItem; onUpdate: (payload: Partial<KnowledgeEntryItem>) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);
  return <article className="rounded-lg border border-line-subtle p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-ink">{entry.title}</h3><Badge tone="neutral">{entry.entry_type.toLowerCase()}</Badge></div><p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-secondary">{entry.content}</p><p className="mt-2 text-[11px] text-ink-muted">{entry.collection} · updated {new Date(entry.updated_at).toLocaleDateString()}</p></div><button aria-label={`Delete ${entry.title}`} onClick={onDelete} className="rounded p-2 text-ink-muted hover:bg-danger-light hover:text-danger"><Trash2 className="h-4 w-4" /></button></div><details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-brand">Edit note</summary><div className="mt-3 space-y-2"><Input aria-label="Knowledge title" value={title} onChange={(event) => setTitle(event.target.value)} /><Textarea className="min-h-24 w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm" aria-label="Knowledge content" value={content} onChange={(event) => setContent(event.target.value)} /><Button size="sm" onClick={() => onUpdate({ title, content })}>Save changes</Button></div></details></article>;
}

function PlaybookRow({ book, request, onRequest, onRun, running, onUpdate, onDelete }: { book: PlaybookItem; request: string; onRequest: (value: string) => void; onRun: () => void; running: boolean; onUpdate: (payload: Partial<PlaybookItem>) => void; onDelete: () => void }) {
  const [name, setName] = useState(book.name);
  const [description, setDescription] = useState(book.description);
  const [steps, setSteps] = useState(book.steps_json);
  return <article className="rounded-lg border border-line-subtle p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-ink">{book.name}</h3><p className="mt-1 text-xs leading-relaxed text-ink-secondary">{book.description || "Reusable workflow"}</p><ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-ink-muted">{book.steps_json.map((step, index) => <li key={`${step.action}-${index}`}>{step.title} <span className="text-ink-muted">({step.action.replaceAll("_", " ")})</span></li>)}</ol>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={request} onChange={(event) => onRequest(event.target.value)} placeholder="What should this run accomplish?" aria-label={`Request for ${book.name}`} /><Button size="sm" onClick={onRun} loading={running}><Play className="h-3.5 w-3.5" />Run</Button></div><details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-brand">Edit playbook</summary><div className="mt-3 space-y-2"><Input aria-label="Playbook name" value={name} onChange={(event) => setName(event.target.value)} /><Textarea className="min-h-20 w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm" aria-label="Playbook description" value={description} onChange={(event) => setDescription(event.target.value)} />{steps.map((step, index) => <Input key={index} aria-label={`Edit step ${index + 1}`} value={step.title} onChange={(event) => setSteps((current) => current.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} />)}<Button size="sm" onClick={() => onUpdate({ name, description, steps_json: steps })}>Save changes</Button></div></details></div><button aria-label={`Delete ${book.name}`} onClick={onDelete} className="rounded p-2 text-ink-muted hover:bg-danger-light hover:text-danger"><Trash2 className="h-4 w-4" /></button></div></article>;
}
