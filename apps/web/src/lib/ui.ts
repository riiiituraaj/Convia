import type { Commitment, CommitmentStatus, RiskSeverity } from "./types";

/**
 * Shared presentation helpers for the CONVIA design system.
 *
 * These functions contain no business logic: they only translate values the
 * existing backend already produces into consistent visual language.
 */

export type Tone = "brand" | "success" | "danger" | "warning" | "info" | "neutral";

interface ToneStyle {
  /** Badge / chip surface */
  badge: string;
  /** Small status dot */
  dot: string;
  /** Soft filled panel */
  soft: string;
  /** Icon / text colour */
  text: string;
  /** Hex used by SVG fills (graphs, progress rings) */
  hex: string;
}

export const TONES: Record<Tone, ToneStyle> = {
  brand: {
    badge: "bg-brand-light text-brand-deep border-brand-light",
    dot: "bg-brand-accent",
    soft: "bg-brand-pale border-brand-light",
    text: "text-brand",
    hex: "#25A866",
  },
  success: {
    badge: "bg-success-light text-success border-success-light",
    dot: "bg-success",
    soft: "bg-success-light border-success-light",
    text: "text-success",
    hex: "#287747",
  },
  danger: {
    badge: "bg-danger-light text-danger border-[#F8D4D4]",
    dot: "bg-danger",
    soft: "bg-danger-light border-[#F8D4D4]",
    text: "text-danger",
    hex: "#C62828",
  },
  warning: {
    badge: "bg-warning-light text-warning border-[#F7E2B8]",
    dot: "bg-warning",
    soft: "bg-warning-light border-[#F7E2B8]",
    text: "text-warning",
    hex: "#8A5A00",
  },
  info: {
    badge: "bg-info-light text-info border-[#CFE3FF]",
    dot: "bg-info",
    soft: "bg-info-light border-[#CFE3FF]",
    text: "text-info",
    hex: "#0B5CAD",
  },
  neutral: {
    badge: "bg-surface-sunken text-ink-secondary border-line",
    dot: "bg-ink-muted",
    soft: "bg-surface-sunken border-line-subtle",
    text: "text-ink-secondary",
    hex: "#7B8883",
  },
};

export function toneClasses(tone: Tone): ToneStyle {
  return TONES[tone] ?? TONES.neutral;
}

export function riskTone(level: RiskSeverity | string | undefined): Tone {
  switch (level) {
    case "CRITICAL":
    case "HIGH":
      return "danger";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "success";
    default:
      return "neutral";
  }
}

export function commitmentStatusTone(status: CommitmentStatus | string): Tone {
  switch (status) {
    case "AT_RISK":
      return "danger";
    case "RECOVERY":
      return "warning";
    case "DETECTED":
    case "PENDING_CONFIRMATION":
      return "info";
    case "CLOSED":
    case "COMPLETED":
    case "VERIFIED":
      return "success";
    case "CONFIRMED":
    case "PLANNED":
    case "IN_PROGRESS":
      return "brand";
    default:
      return "neutral";
  }
}

export function priorityTone(priority: string | undefined): Tone {
  switch (priority) {
    case "URGENT":
      return "danger";
    case "HIGH":
      return "warning";
    case "LOW":
      return "neutral";
    case "MEDIUM":
    default:
      return "info";
  }
}

/** `IN_PROGRESS` -> `In progress`, `AT_RISK` -> `At risk` */
export function prettyLabel(value: string | undefined | null): string {
  if (!value) return "Unknown";
  const lower = value.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function isClosed(status: string): boolean {
  return status === "CLOSED" || status === "COMPLETED" || status === "VERIFIED";
}

export function clampPercent(value: number | undefined | null): number {
  if (value === undefined || value === null || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function initials(name: string | undefined | null): string {
  if (!name) return "CV";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "CV";
}

export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function dateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}


/** Whole days between now and the given ISO date. Negative means overdue. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((targetDay.getTime() - today.getTime()) / 86_400_000);
}

export interface DueInfo {
  tone: Tone;
  label: string;
  isOverdue: boolean;
}

/**
 * Deadline semantics used by stat cards, the timeline and commitment cards.
 * Red = urgent, amber = approaching, grey = normal, green = completed.
 */
export function dueInfo(deadline: string | null | undefined, status?: string): DueInfo {
  if (status && isClosed(status)) {
    return { tone: "success", label: "Completed", isOverdue: false };
  }

  const days = daysUntil(deadline);

  if (days === null) {
    return { tone: "neutral", label: "No deadline set", isOverdue: false };
  }

  if (days < 0) {
    return {
      tone: "danger",
      label: days === -1 ? "Overdue by 1 day" : `Overdue by ${Math.abs(days)} days`,
      isOverdue: true,
    };
  }

  if (days === 0) return { tone: "danger", label: "Due today", isOverdue: false };
  if (days === 1) return { tone: "warning", label: "Due tomorrow", isOverdue: false };
  if (days <= 3) return { tone: "warning", label: `Due in ${days} days`, isOverdue: false };

  return { tone: "neutral", label: `Due in ${days} days`, isOverdue: false };
}

/** `2026-09-24T09:00:00` -> `{ day: "24", month: "SEP" }` */
export function calendarChip(dateStr: string | null | undefined): {
  day: string;
  month: string;
} {
  if (!dateStr) return { day: "--", month: "---" };
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return { day: "--", month: "---" };
  return {
    day: date.toLocaleDateString("en-US", { day: "2-digit" }),
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
  };
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "just now";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";

  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Not scheduled";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Nearest deadlines first; commitments without a deadline last. */
export function sortByDeadline<T extends { deadline?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}
