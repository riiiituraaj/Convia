import {
  User,
  Mission,
  Commitment,
  Risk,
  ActionPassport,
  AgentRun,
  MemoryItem,
  IntegrationItem,
  GoogleMessageItem,
  GoogleCalendarEventItem,
  GoogleDriveFileItem,
  BlindSpotsData,
  ResolveDayData,
  PersonProfile,
  WaitingData,
  ConversationSummary,
  ConversationDetail,
  ConversationTurnResult,
  ContextDiagnostics,
  IntentCaptureResult,
  DocumentItem,
  DocumentAnswer,
  ResearchSessionItem,
  ArtifactItem,
  ArtifactSummaryItem,
  TravelProviderStatus,
  TravelSearchResult,
  ContextPackItem,
  KnowledgeEntryItem,
  PlaybookItem,
  StudioResult,
} from "./types";
import { getToken, setSession, clearSession, type AuthSession } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const token = getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      if (res.status === 401 && !["/auth/login", "/auth/register"].includes(endpoint)) {
        clearSession();
        if (typeof window !== "undefined") window.location.assign("/login");
      }
      const errorBody = await res.json().catch(() => null) as { detail?: unknown } | null;
      const detail = typeof errorBody?.detail === "string" ? errorBody.detail : "Request could not be completed.";
      throw new Error(`API Error ${res.status}: ${detail}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // Health
  async checkHealth(): Promise<{ status: string; product: string }> {
    return this.request<{ status: string; product: string }>("/health");
  }

  // Authentication / identity
  async getMe(): Promise<User> {
    return this.request<User>("/auth/me");
  }

  async updateMe(payload: Partial<Pick<User, "full_name" | "autonomy_level" | "voice_enabled" | "preferred_voice" | "timezone_pref">>): Promise<User> {
    return this.request<User>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const session = await this.request<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setSession(session);
    return session;
  }

  async register(email: string, password: string, full_name: string): Promise<AuthSession> {
    const session = await this.request<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    });
    setSession(session);
    return session;
  }

  logout(): void {
    clearSession();
  }

  // Demo
  async seedFlagshipDemo(): Promise<{ status: string; message: string; mission_id: string; passport_id: string }> {
    return this.request("/demo/seed", { method: "POST" });
  }

  // Conversations
  async getConversations(): Promise<ConversationSummary[]> {
    return this.request<ConversationSummary[]>("/conversations");
  }

  async getConversation(id: string): Promise<ConversationDetail> {
    return this.request<ConversationDetail>(`/conversations/${id}`);
  }

  async createConversation(title?: string, context_pack_id?: string): Promise<ConversationDetail> {
    return this.request<ConversationDetail>("/conversations", {
      method: "POST",
      body: JSON.stringify({ title, context_pack_id }),
    });
  }

  async deleteConversation(id: string): Promise<void> {
    await this.request<void>(`/conversations/${id}`, { method: "DELETE" });
  }

  async sendMessage(
    conversationId: string,
    content: string,
    source: string = "text",
    clientMessageId: string = crypto.randomUUID(),
  ): Promise<ConversationTurnResult> {
    return this.request<ConversationTurnResult>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, source, client_message_id: clientMessageId }),
    });
  }

  async getContextPreview(conversationId: string, query: string = ""): Promise<ContextDiagnostics> {
    const suffix = query ? `?query=${encodeURIComponent(query)}` : "";
    return this.request<ContextDiagnostics>(`/conversations/${conversationId}/context-preview${suffix}`);
  }

  // Missions
  async getMissions(): Promise<Mission[]> {
    return this.request<Mission[]>("/missions");
  }

  async getMission(id: string): Promise<Mission> {
    return this.request<Mission>(`/missions/${id}`);
  }

  async createMission(payload: Partial<Mission>): Promise<Mission> {
    return this.request<Mission>("/missions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Commitments
  async getCommitments(filterBy: string = "ALL"): Promise<Commitment[]> {
    return this.request<Commitment[]>(`/commitments?filter_by=${filterBy}`);
  }

  async createCommitment(payload: Partial<Commitment>): Promise<Commitment> {
    return this.request<Commitment>("/commitments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateCommitment(id: string, payload: Partial<Commitment>): Promise<Commitment> {
    return this.request<Commitment>(`/commitments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // Risks
  async getRisks(): Promise<Risk[]> {
    return this.request<Risk[]>("/risks");
  }

  async executeRecovery(riskId: string, optionId: string): Promise<{ message: string; passport_id: string }> {
    return this.request(`/risks/${riskId}/recover`, {
      method: "POST",
      body: JSON.stringify({ option_id: optionId }),
    });
  }

  // Action Passports
  async getActions(): Promise<ActionPassport[]> {
    return this.request<ActionPassport[]>("/actions");
  }

  async decideAction(passportId: string, decision: "APPROVE" | "REJECT", notes?: string): Promise<ActionPassport> {
    return this.request<ActionPassport>(`/actions/${passportId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, notes }),
    });
  }

  // Intents & Signatures
  async parseIntent(text: string, source: string = "text", conversationId?: string): Promise<IntentCaptureResult> {
    return this.request("/intents/parse", {
      method: "POST",
      body: JSON.stringify({ raw_text: text, source, conversation_id: conversationId }),
    });
  }

  async getBlindSpots(): Promise<BlindSpotsData> {
    return this.request<BlindSpotsData>("/intents/blind-spots");
  }

  async getResolveDay(): Promise<ResolveDayData> {
    return this.request<ResolveDayData>("/intents/resolve-day");
  }

  // Durable Agent Runtime
  async getAgentRuns(): Promise<AgentRun[]> {
    return this.request<AgentRun[]>("/agents/runs");
  }

  async getAgentRun(id: string): Promise<AgentRun> {
    return this.request<AgentRun>(`/agents/runs/${id}`);
  }

  async createAgentRun(task_description: string, mission_id?: string, conversation_id?: string): Promise<AgentRun> {
    return this.request<AgentRun>("/agents/runs", {
      method: "POST",
      body: JSON.stringify({ task_description, mission_id, conversation_id }),
    });
  }

  async pauseAgentRun(id: string): Promise<AgentRun> {
    return this.request<AgentRun>(`/agents/runs/${id}/pause`, { method: "POST" });
  }

  async resumeAgentRun(id: string): Promise<AgentRun> {
    return this.request<AgentRun>(`/agents/runs/${id}/resume`, { method: "POST" });
  }

  async cancelAgentRun(id: string): Promise<AgentRun> {
    return this.request<AgentRun>(`/agents/runs/${id}/cancel`, { method: "POST" });
  }

  async retryAgentStep(id: string, stepIndex: number = 0): Promise<AgentRun> {
    return this.request<AgentRun>(`/agents/runs/${id}/retry?step_index=${stepIndex}`, { method: "POST" });
  }

  async getAgentTools(): Promise<Array<{ name: string; description: string; risk_level: string; requires_approval: boolean }>> {
    return this.request("/agents/tools");
  }

  // Research
  async getResearchSessions(): Promise<ResearchSessionItem[]> {
    return this.request<ResearchSessionItem[]>("/research");
  }

  async getResearchSession(id: string): Promise<ResearchSessionItem> {
    return this.request<ResearchSessionItem>(`/research/${id}`);
  }

  async runResearch(query: string, searchDepth: string = "basic", title?: string): Promise<{
    session_id: string;
    query: string;
    results: Array<{ id: string; title: string; url: string; domain?: string; snippet: string; relevance?: number | null; published_at?: string | null }>;
    answer: string;
    synthesis: string;
    claims: Array<{ claim: string; source_ids: string[]; verified: boolean; citation_valid?: boolean }>;
    evidence: string[];
    provider: string;
    success: boolean;
    error: string;
  }> {
    return this.request("/research", {
      method: "POST",
      body: JSON.stringify({ query, search_depth: searchDepth, title }),
    });
  }

  async convertResearchToArtifact(sessionId: string): Promise<{ artifact_id: string; title: string; artifact_type: string; message: string }> {
    return this.request(`/research/${sessionId}/to-artifact`, { method: "POST" });
  }

  async convertResearchToMission(sessionId: string): Promise<{ mission_id: string; title: string; message: string }> {
    return this.request(`/research/${sessionId}/to-mission`, { method: "POST" });
  }

  async deleteResearchSession(sessionId: string): Promise<void> {
    await this.request<void>(`/research/${sessionId}`, { method: "DELETE" });
  }

  // Shared Artifact System
  async getArtifacts(artifactType?: string, missionId?: string, conversationId?: string): Promise<ArtifactSummaryItem[]> {
    const params = new URLSearchParams();
    if (artifactType) params.set("artifact_type", artifactType);
    if (missionId) params.set("mission_id", missionId);
    if (conversationId) params.set("conversation_id", conversationId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.request<ArtifactSummaryItem[]>(`/artifacts${qs}`);
  }

  async getArtifact(id: string): Promise<ArtifactItem> {
    return this.request<ArtifactItem>(`/artifacts/${id}`);
  }

  async createArtifact(payload: Partial<ArtifactItem>): Promise<ArtifactItem> {
    return this.request<ArtifactItem>("/artifacts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateArtifact(id: string, payload: Partial<ArtifactItem>): Promise<ArtifactItem> {
    return this.request<ArtifactItem>(`/artifacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteArtifact(id: string): Promise<void> {
    await this.request<void>(`/artifacts/${id}`, { method: "DELETE" });
  }

  async downloadArtifact(id: string, format: "markdown" | "json" = "markdown"): Promise<Blob> {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/artifacts/${id}/export?format=${format}`, { headers });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null) as { detail?: unknown } | null;
      throw new Error(typeof errorBody?.detail === "string" ? errorBody.detail : "Artifact export failed.");
    }
    return res.blob();
  }

  // Travel Readiness
  async getTravelStatus(): Promise<TravelProviderStatus> {
    return this.request<TravelProviderStatus>("/travel/status");
  }

  async searchFlights(payload: { origin: string; destination: string; departure_date: string; passengers?: number; cabin_class?: string }): Promise<TravelSearchResult> {
    return this.request<TravelSearchResult>("/travel/flights/search", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async searchHotels(payload: { destination: string; check_in_date: string; check_out_date: string; guests?: number; rooms?: number }): Promise<TravelSearchResult> {
    return this.request<TravelSearchResult>("/travel/hotels/search", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Memory
  async getMemories(): Promise<MemoryItem[]> {
    return this.request<MemoryItem[]>("/memory");
  }

  async createMemory(payload: Partial<MemoryItem>): Promise<MemoryItem> {
    return this.request<MemoryItem>("/memory", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async deleteMemory(id: string): Promise<{ message: string }> {
    return this.request(`/memory/${id}`, { method: "DELETE" });
  }

  // Integrations
  async getIntegrations(): Promise<IntegrationItem[]> {
    return this.request<IntegrationItem[]>("/integrations");
  }

  async connectGoogle(): Promise<{ authorization_url: string }> {
    return this.request<{ authorization_url: string }>("/integrations/google/connect", { method: "POST" });
  }

  async disconnectGoogle(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/integrations/google", { method: "DELETE" });
  }

  async getGoogleMessages(q = ""): Promise<{ query: string; messages: GoogleMessageItem[] }> {
    const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
    return this.request<{ query: string; messages: GoogleMessageItem[] }>(`/integrations/google/messages${suffix}`);
  }

  async getGoogleEvents(): Promise<{ events: GoogleCalendarEventItem[] }> {
    return this.request<{ events: GoogleCalendarEventItem[] }>("/integrations/google/events");
  }

  async getGoogleFiles(): Promise<{ files: GoogleDriveFileItem[] }> {
    return this.request<{ files: GoogleDriveFileItem[] }>("/integrations/google/files");
  }

  // Voice
  async respondToVoice(transcript: string): Promise<{ text_response: string; provider_used: string; audio_url?: string | null }> {
    return this.request("/voice/respond", {
      method: "POST",
      body: JSON.stringify({ transcript }),
    });
  }

  async transcribeAudio(file: Blob, filename = "audio.webm"): Promise<{
    transcript: string;
    provider: string;
    status: string;
    message?: string;
    error?: string;
  }> {
    const form = new FormData();
    form.append("file", file, filename);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/voice/transcribe`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null) as { detail?: unknown; message?: unknown } | null;
      const message =
        typeof errorBody?.message === "string"
          ? errorBody.message
          : typeof errorBody?.detail === "string"
            ? errorBody.detail
            : `Transcribe failed: ${res.status}`;
      throw new Error(message);
    }
    return res.json();
  }

  // People
  async getPeople(): Promise<PersonProfile[]> {
    return this.request<PersonProfile[]>("/people");
  }

  async getWaiting(): Promise<WaitingData> {
    return this.request<WaitingData>("/people/waiting");
  }

  // Private document vault
  async getDocuments(query = ""): Promise<DocumentItem[]> {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
    return this.request<DocumentItem[]>(`/documents${suffix}`);
  }

  async uploadDocument(file: File): Promise<DocumentItem> {
    const form = new FormData();
    form.append("file", file);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/documents`, { method: "POST", headers, body: form });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null) as { detail?: unknown } | null;
      const detail = typeof errorBody?.detail === "string" ? errorBody.detail : "Document upload failed.";
      throw new Error(detail);
    }
    return res.json();
  }

  async deleteDocument(id: string): Promise<void> {
    await this.request<void>(`/documents/${id}`, { method: "DELETE" });
  }

  async askDocument(id: string, question: string): Promise<DocumentAnswer> {
    return this.request<DocumentAnswer>(`/documents/${id}/ask`, {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  }

  async summarizeDocument(id: string, options: { mode?: string; purpose?: string; audience?: string; length?: string } = {}): Promise<DocumentAnswer> {
    return this.request<DocumentAnswer>(`/documents/${id}/summary`, { method: "POST", body: JSON.stringify(options) });
  }

  async previewDocument(id: string, start = 0): Promise<{ filename: string; total_passages: number; passages: Array<{ ordinal: number; locator: string; text: string }> }> {
    return this.request(`/documents/${id}/preview?start=${start}`);
  }

  async downloadDocument(id: string): Promise<Blob> {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/documents/${id}/download`, { headers });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null) as { detail?: unknown } | null;
      throw new Error(typeof errorBody?.detail === "string" ? errorBody.detail : "Document download failed.");
    }
    return res.blob();
  }

  // Knowledge Vault and reusable Context Packs
  async getContextPacks(): Promise<ContextPackItem[]> { return this.request("/context-packs"); }
  async createContextPack(payload: Partial<ContextPackItem> & { title: string }): Promise<ContextPackItem> {
    return this.request("/context-packs", { method: "POST", body: JSON.stringify(payload) });
  }
  async updateContextPack(id: string, payload: Partial<ContextPackItem>): Promise<ContextPackItem> {
    return this.request(`/context-packs/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
  async deleteContextPack(id: string): Promise<void> { return this.request(`/context-packs/${id}`, { method: "DELETE" }); }
  async resumeContextPack(id: string): Promise<{ pack: ContextPackItem; resources: Array<Record<string, unknown>> }> {
    return this.request(`/context-packs/${id}/context`);
  }
  async getKnowledge(q = ""): Promise<KnowledgeEntryItem[]> {
    return this.request(`/knowledge${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }
  async createKnowledge(payload: Partial<KnowledgeEntryItem> & { title: string; content: string }): Promise<KnowledgeEntryItem> {
    return this.request("/knowledge", { method: "POST", body: JSON.stringify(payload) });
  }
  async updateKnowledge(id: string, payload: Partial<KnowledgeEntryItem>): Promise<KnowledgeEntryItem> {
    return this.request(`/knowledge/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
  async deleteKnowledge(id: string): Promise<void> { return this.request(`/knowledge/${id}`, { method: "DELETE" }); }

  // User-owned workflows and Studio tools
  async getPlaybooks(): Promise<PlaybookItem[]> { return this.request("/playbooks"); }
  async createPlaybook(payload: Partial<PlaybookItem> & { name: string; steps_json: Array<{ title: string; action: string }> }): Promise<PlaybookItem> {
    return this.request("/playbooks", { method: "POST", body: JSON.stringify(payload) });
  }
  async updatePlaybook(id: string, payload: Partial<PlaybookItem>): Promise<PlaybookItem> {
    return this.request(`/playbooks/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
  async deletePlaybook(id: string): Promise<void> { return this.request(`/playbooks/${id}`, { method: "DELETE" }); }
  async runPlaybook(id: string, inputs: Record<string, string>): Promise<{ agent_run: AgentRun; status: string; message: string }> {
    return this.request(`/playbooks/${id}/run`, { method: "POST", body: JSON.stringify(inputs) });
  }
  async runStudio(payload: { task_type: string; title: string; text: string; context?: string; options?: Record<string, unknown> }): Promise<StudioResult> {
    return this.request("/studio/run", { method: "POST", body: JSON.stringify(payload) });
  }
  async createMissionFromMeeting(artifact_id: string, title: string, action_indexes: number[]): Promise<{ mission_id: string; title: string; commitments_created: number; message: string }> {
    return this.request("/studio/meeting-to-mission", { method: "POST", body: JSON.stringify({ artifact_id, title, action_indexes }) });
  }
  async analyzeSpreadsheet(filename: string, csv_text: string): Promise<Record<string, unknown>> {
    return this.request("/studio/spreadsheet", { method: "POST", body: JSON.stringify({ filename, csv_text }) });
  }
  async analyzeSpreadsheetDocument(documentId: string): Promise<Record<string, unknown>> {
    return this.request(`/studio/spreadsheet/document/${documentId}`, { method: "POST" });
  }
  async compareDocuments(document_ids: string[], question?: string): Promise<Record<string, unknown>> {
    return this.request("/studio/compare-documents", { method: "POST", body: JSON.stringify({ document_ids, question }) });
  }
  async getBriefing(): Promise<Record<string, unknown>> { return this.request("/briefing"); }
}

export const api = new ApiClient();
