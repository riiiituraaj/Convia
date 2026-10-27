export interface User {
  id: string;
  email: string;
  full_name: string;
  autonomy_level: number;
  voice_enabled: boolean;
  preferred_voice: string;
  timezone_pref: string;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  source: string;
  status: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  summary_text?: string | null;
  context_pack_id?: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_preview?: string | null;
}

export interface ConversationDetail {
  id: string;
  title: string;
  summary_text?: string | null;
  context_pack_id?: string | null;
  created_at: string;
  updated_at: string;
  messages: ConversationMessage[];
}

export interface ContextDiagnostics {
  conversation_id: string;
  total_items: number;
  categories_present: string[];
  items: Array<{
    category: string;
    provenance: string;
    source_id: string;
    snippet: string;
    confidence?: number | null;
    locator?: string | null;
  }>;
  active_constraints: Record<string, any>;
  history_message_count: number;
  truncated: boolean;
  summary_applied: boolean;
}

export interface ConversationTurnResult {
  user_message: ConversationMessage;
  assistant_message: ConversationMessage;
  active_constraints: Record<string, any>;
  diagnostics?: ContextDiagnostics | null;
}

export interface DocumentItem {
  id: string;
  filename: string;
  media_type: string;
  extension: string;
  size_bytes: number;
  sha256: string;
  source_count: number | null;
  status: string;
  summary_text: string | null;
  summary_model: string | null;
  summary_updated_at: string | null;
  created_at: string;
  updated_at: string;
  chunk_count: number;
}

export interface DocumentSource {
  reference: string;
  locator: string;
  excerpt: string;
}

export interface DocumentAnswer {
  answer: string | null;
  status: string;
  provider: string;
  message: string;
  sources: DocumentSource[];
  artifact_id?: string | null;
}

export interface IntentCaptureResult {
  conversation_id: string;
  recognized_intent: string;
  extracted_mission?: Mission | null;
  commitments: Commitment[];
  signals_detected: string[];
  summary_message: string;
  confidence?: number | null;
  model_used: string;
}

export type CommitmentStatus =
  | "DETECTED"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "PLANNED"
  | "IN_PROGRESS"
  | "AT_RISK"
  | "RECOVERY"
  | "COMPLETED"
  | "VERIFIED"
  | "CLOSED";

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CommitmentEvent {
  id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: string;
}

export interface Commitment {
  id: string;
  user_id: string;
  mission_id?: string | null;
  action: string;
  recipient?: string | null;
  actor: string;
  context?: string | null;
  deadline?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  risk_score: number;
  risk_level: RiskSeverity;
  status: CommitmentStatus;
  confidence?: number | null;
  dependencies: string[];
  consequences?: string | null;
  evidence?: string | null;
  completion_condition?: string | null;
  autonomy_level: number;
  created_at: string;
  updated_at: string;
  events?: CommitmentEvent[];
}

export interface MissionNode {
  id: string;
  title: string;
  node_type: "OBJECTIVE" | "TASK" | "MILESTONE" | "CHECKPOINT";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
  progress: number;
  position_x: number;
  position_y: number;
  metadata_json: Record<string, any>;
}

export interface MissionEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: "BLOCKS" | "ENABLES" | "PARALLEL";
}

export interface Mission {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  desired_outcome?: string | null;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "AT_RISK";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  progress: number;
  target_date?: string | null;
  budget_limit?: number | null;
  budget_currency: string;
  constraints: Record<string, any>;
  created_at: string;
  updated_at: string;
  nodes?: MissionNode[];
  edges?: MissionEdge[];
  commitments?: Commitment[];
}

export interface RecoveryOption {
  id: string;
  title: string;
  description: string;
  effort: "LOW" | "MEDIUM" | "HIGH";
  risk: "LOW" | "MEDIUM" | "HIGH";
  expected_outcome: string;
  affected_commitments: string[];
  action_type: string;
  action_payload: Record<string, any>;
}

export interface Risk {
  id: string;
  user_id: string;
  mission_id?: string | null;
  commitment_id?: string | null;
  title: string;
  description: string;
  severity: RiskSeverity;
  score: number;
  evidence: string[];
  affected_commitments: string[];
  recovery_strategies: RecoveryOption[];
  is_resolved: boolean;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionPassport {
  id: string;
  user_id: string;
  commitment_id?: string | null;
  mission_id?: string | null;
  action_name: string;
  why: string;
  evidence: string[];
  expected_impact: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  is_reversible: boolean;
  approval_required: boolean;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXECUTED" | "VERIFIED";
  execution_payload: Record<string, any>;
  execution_result: Record<string, any>;
  verification_record: Record<string, any>;
  created_at: string;
  executed_at?: string | null;
  verified_at?: string | null;
}

export interface AgentStep {
  id: string;
  run_id: string;
  step_index: number;
  title: string;
  tool_name: string;
  input_payload: Record<string, any>;
  output_payload: Record<string, any>;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "AWAITING_APPROVAL" | "FAILED" | "SKIPPED" | "CANCELLED";
  error_message?: string | null;
  requires_approval: boolean;
  action_passport_id?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface AgentRun {
  id: string;
  user_id: string;
  agent_type: string;
  task_description: string;
  status: "QUEUED" | "PLANNING" | "RUNNING" | "AWAITING_APPROVAL" | "PAUSED" | "COMPLETED" | "PARTIALLY_COMPLETED" | "BLOCKED" | "FAILED" | "CANCELLED";
  model_used: string;
  latency_ms: number;
  input_payload: Record<string, any>;
  output_payload: Record<string, any>;
  events: Array<Record<string, any>>;
  plan_json?: Array<Record<string, any>>;
  steps?: AgentStep[];
  created_at: string;
  completed_at?: string | null;
}

export interface ResearchSourceItem {
  id: string;
  url: string;
  title: string;
  source: string;
  domain?: string | null;
  snippet: string;
  relevance?: number | null;
  retrieval_status: string;
  published_at?: string | null;
  retrieved_at: string;
}

export interface ResearchSessionItem {
  id: string;
  title: string;
  original_query: string;
  status: string;
  summary?: string | null;
  synthesis?: string | null;
  claims_json?: Array<{
    claim: string;
    source_ids: string[];
    verified: boolean;
    citation_valid?: boolean;
    invalid_citations_detected?: string[];
  }>;
  sources_count?: number;
  sources?: ResearchSourceItem[];
  created_at: string;
  updated_at: string;
}

export interface ArtifactItem {
  id: string;
  user_id: string;
  mission_id?: string | null;
  agent_run_id?: string | null;
  conversation_id?: string | null;
  title: string;
  artifact_type: string;
  content: string;
  summary?: string | null;
  sources_json: Array<Record<string, any>>;
  metadata_json: Record<string, any>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ArtifactSummaryItem {
  id: string;
  title: string;
  artifact_type: string;
  summary?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OfficialSearchLink {
  provider_name: string;
  label: string;
  url: string;
  notes: string;
}

export interface TravelSearchResult {
  search_type: "FLIGHTS" | "HOTELS";
  provider: string;
  configured: boolean;
  live_inventory_available: boolean;
  offers: Array<Record<string, unknown>>;
  message: string;
  official_search_links: OfficialSearchLink[];
}

export interface TravelProviderStatus {
  live_booking_enabled: boolean;
  policy: string;
  providers: Record<string, {
    name: string;
    configured: boolean;
    status: string;
    direct_booking_enabled: boolean;
  }>;
}

export interface MemoryItem {
  id: string;
  user_id: string;
  category: "EXPLICIT" | "MISSION" | "TEMPORARY" | "DERIVED_PREFERENCE" | "EXTERNAL_KNOWLEDGE";
  content: string;
  source: string;
  confidence: number;
  retention_rule: string;
  user_visible: boolean;
  created_at: string;
}

export interface IntegrationItem {
  id: string;
  provider: string;
  status: "CONFIGURED" | "NOT_CONFIGURED" | "CONNECTED" | "NOT_CONNECTED" | "COMING_SOON" | "DEMO_FALLBACK";
  credentials_present: boolean;
  last_synced_at?: string | null;
  metadata_json: Record<string, any>;
}

export interface GoogleMessageItem {
  id: string;
  thread_id?: string | null;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
}

export interface GoogleCalendarEventItem {
  id: string;
  summary: string;
  start?: string;
  end?: string;
  location?: string;
  html_link?: string;
}

export interface GoogleDriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface BlindSpotsData {
  total_found: number;
  unresolved_dependencies: Array<Record<string, any>>;
  waiting_on_user: Array<Record<string, any>>;
  expiring_windows: Array<Record<string, any>>;
  schedule_conflicts: Array<Record<string, any>>;
  insights: string[];
}

export interface ResolveDayData {
  plan_date: string;
  total_hours_required: number;
  critical_commitments_protected: number;
  schedule: Array<{
    time_slot: string;
    commitment_id?: string | null;
    title: string;
    priority: string;
    why: string;
    estimated_minutes: number;
    action_type: string;
  }>;
  tradeoffs_made: string[];
  continuity_status: string;
}

export interface PersonProfile {
  name: string;
  waiting_on_user: Array<{
    commitment_id: string;
    action: string;
    status: string;
    deadline?: string | null;
  }>;
  user_waiting_on: Array<{
    commitment_id: string;
    action: string;
    status: string;
    deadline?: string | null;
  }>;
  last_interaction: string;
  total_commitments: number;
  open_commitments: number;
}

export interface WaitingData {
  they_wait_on_you: Array<{
    person: string;
    commitment_id: string;
    action: string;
    context?: string | null;
    status: string;
    deadline?: string | null;
    consequences?: string | null;
  }>;
  you_wait_on_them: Array<{
    person: string;
    commitment_id: string;
    action: string;
    waiting_for: string;
    status: string;
  }>;
}

export interface ContextPackItem {
  id: string;
  title: string;
  objective: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  facts_json: Array<Record<string, unknown>>;
  constraints_json: string[];
  questions_json: string[];
  links_json: Array<Record<string, unknown>>;
  resource_refs_json: Record<string, string[]>;
  tags_json: string[];
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEntryItem {
  id: string;
  title: string;
  content: string;
  entry_type: "NOTE" | "FINDING" | "DECISION" | "DEFINITION" | "LINK";
  collection: string;
  tags_json: string[];
  provenance_json: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

export interface PlaybookItem {
  id: string;
  name: string;
  description: string;
  inputs_json: Array<{ name?: string; description?: string; required?: boolean }>;
  steps_json: Array<{ title: string; action: string }>;
  created_at: string;
  updated_at: string;
}

export interface StudioResult {
  artifact_id: string;
  title: string;
  artifact_type: string;
  content: string;
  generated_by: string;
  sources: Array<Record<string, unknown>>;
  status: string;
}
