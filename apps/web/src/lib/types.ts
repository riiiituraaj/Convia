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
  actor: string;
  recipient?: string | null;
  action: string;
  context?: string | null;
  deadline?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: CommitmentStatus;
  confidence: number;
  risk_score: number;
  risk_level: RiskSeverity;
  dependencies: string[];
  consequences?: string | null;
  evidence?: string | null;
  completion_condition?: string | null;
  autonomy_level: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  events?: CommitmentEvent[];
}

export interface MissionNode {
  id: string;
  mission_id: string;
  title: string;
  node_type: "OBJECTIVE" | "TASK" | "MILESTONE" | "EXTERNAL";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
  progress: number;
  position_x: number;
  position_y: number;
  metadata_json: Record<string, any>;
  created_at: string;
}

export interface MissionEdge {
  id: string;
  mission_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: "BLOCKS" | "FEEDS_INTO" | "RELIES_ON";
  created_at: string;
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

export interface AgentRun {
  id: string;
  user_id: string;
  agent_type: string;
  task_description: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "WAITING_APPROVAL";
  model_used: string;
  latency_ms: number;
  input_payload: Record<string, any>;
  output_payload: Record<string, any>;
  events: Array<Record<string, any>>;
  created_at: string;
  completed_at?: string | null;
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
  status: "CONNECTED" | "NOT_CONNECTED" | "COMING_SOON" | "DEMO_FALLBACK";
  credentials_present: boolean;
  last_synced_at?: string | null;
  metadata_json: Record<string, any>;
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

