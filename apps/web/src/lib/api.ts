import {
  User,
  Mission,
  Commitment,
  Risk,
  ActionPassport,
  AgentRun,
  MemoryItem,
  IntegrationItem,
  BlindSpotsData,
  ResolveDayData,
  PersonProfile,
  WaitingData,
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

    try {
      const res = await fetch(url, { ...options, headers });
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`API Error ${res.status}: ${errorBody}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      console.warn(`Fetch error for ${url}:`, err);
      throw err;
    }
  }

  // Health
  async checkHealth(): Promise<{ status: string; product: string }> {
    return this.request<{ status: string; product: string }>("/health");
  }

  // Authentication / identity (the API auto-provisions a continuity user)
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

  async decideAction(passportId: string, decision: "APPROVE" | "REJECT"): Promise<ActionPassport> {
    return this.request<ActionPassport>(`/actions/${passportId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
  }

  // Intents & Signatures
  async parseIntent(text: string, source: string = "text") {
    return this.request("/intents/parse", {
      method: "POST",
      body: JSON.stringify({ raw_text: text, source }),
    });
  }

  async getBlindSpots(): Promise<BlindSpotsData> {
    return this.request<BlindSpotsData>("/intents/blind-spots");
  }

  async getResolveDay(): Promise<ResolveDayData> {
    return this.request<ResolveDayData>("/intents/resolve-day");
  }

  // Agents
  async getAgentRuns(): Promise<AgentRun[]> {
    return this.request<AgentRun[]>("/agents/runs");
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
      throw new Error(`Transcribe failed: ${res.status}`);
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

  // Research (Tavily with local fallback)
  async runResearch(query: string, searchDepth: string = "basic"): Promise<{
    query: string;
    results: Array<{ title: string; url: string; source: string; snippet: string; relevance: number }>;
    answer: string;
    evidence: string[];
    provider: string;
    success: boolean;
    error: string;
  }> {
    return this.request("/research", {
      method: "POST",
      body: JSON.stringify({ query, search_depth: searchDepth }),
    });
  }
}

export const api = new ApiClient();

