"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  CalendarCheck,
  CheckCircle2,
  EyeOff,
  Gavel,
  Mic,
  Play,
  Plug,
  Search,
  Settings,
  ShieldAlert,
  Target,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { IconButton } from "@/components/ui/Button";

interface Command {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  group: "Actions" | "Navigate";
  action: () => void | Promise<void>;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenVoice: () => void;
}

const go = (path: string, onClose: () => void, push: (path: string) => void) => () => {
  onClose();
  push(path);
};

/** Command centre: ⌘K search across every CONVIA action and destination. */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenVoice,
}) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "talk_voice",
        title: "Talk to Convia",
        subtitle: "Speak naturally using voice continuity",
        icon: Mic,
        group: "Actions",
        action: () => {
          onClose();
          onOpenVoice();
        },
      },
      {
        id: "find_blind_spots",
        title: "Find my blind spots",
        subtitle: "Scan for forgotten dependencies and waiting people",
        icon: EyeOff,
        group: "Actions",
        action: go("/life#blind-spots", onClose, router.push),
      },
      {
        id: "resolve_my_day",
        title: "Resolve my day",
        subtitle: "Generate a realistic plan protecting commitments",
        icon: CalendarCheck,
        group: "Actions",
        action: go("/life#resolve-day", onClose, router.push),
      },
      {
        id: "seed_demo",
        title: "Run flagship demo: move to Bangalore",
        subtitle: "Load the 21-day relocation scenario",
        icon: Play,
        group: "Actions",
        action: async () => {
          onClose();
          await api.seedFlagshipDemo();
          window.location.reload();
        },
      },
      {
        id: "show_at_risk",
        title: "Show at-risk commitments",
        subtitle: "High-risk commitments and recovery passports",
        icon: ShieldAlert,
        group: "Navigate",
        action: go("/commitments", onClose, router.push),
      },
      {
        id: "open_missions",
        title: "Missions",
        subtitle: "Outcomes and life goals",
        icon: Target,
        group: "Navigate",
        action: go("/missions", onClose, router.push),
      },
      {
        id: "open_commitments",
        title: "Commitments",
        subtitle: "Obligations, recipients and deadlines",
        icon: CheckCircle2,
        group: "Navigate",
        action: go("/commitments", onClose, router.push),
      },
      {
        id: "open_people",
        title: "People",
        subtitle: "Relationship profiles from commitments",
        icon: Users,
        group: "Navigate",
        action: go("/people", onClose, router.push),
      },
      {
        id: "open_waiting",
        title: "Waiting On",
        subtitle: "Who you owe and who owes you",
        icon: Users,
        group: "Navigate",
        action: go("/waiting", onClose, router.push),
      },
      {
        id: "open_decisions",
        title: "Decisions",
        subtitle: "Action Passport approvals",
        icon: Gavel,
        group: "Navigate",
        action: go("/decisions", onClose, router.push),
      },
      {
        id: "open_risks",
        title: "Risks & Recovery",
        subtitle: "Detected risks and recovery alternatives",
        icon: ShieldAlert,
        group: "Navigate",
        action: go("/risks", onClose, router.push),
      },
      {
        id: "open_agents",
        title: "Agent Center",
        subtitle: "Autonomous agent executions and telemetry",
        icon: Bot,
        group: "Navigate",
        action: go("/agents", onClose, router.push),
      },
      {
        id: "open_activity",
        title: "Activity",
        subtitle: "Live agent run telemetry",
        icon: Activity,
        group: "Navigate",
        action: go("/activity", onClose, router.push),
      },
      {
        id: "open_memory",
        title: "Memory",
        subtitle: "Explicit, mission and derived preferences",
        icon: Brain,
        group: "Navigate",
        action: go("/memory", onClose, router.push),
      },
      {
        id: "open_search",
        title: "Search",
        subtitle: "Find anything across CONVIA",
        icon: Search,
        group: "Navigate",
        action: go("/search", onClose, router.push),
      },
      {
        id: "open_integrations",
        title: "Integrations",
        subtitle: "Connected services and provider status",
        icon: Plug,
        group: "Navigate",
        action: go("/integrations", onClose, router.push),
      },
      {
        id: "open_settings",
        title: "Settings",
        subtitle: "Account, autonomy and connected services",
        icon: Settings,
        group: "Navigate",
        action: go("/settings", onClose, router.push),
      },
      {
        id: "open_login",
        title: "Sign in",
        subtitle: "Login or create an account",
        icon: Users,
        group: "Navigate",
        action: go("/login", onClose, router.push),
      },
      {
        id: "open_landing",
        title: "About CONVIA",
        subtitle: "Product overview and principles",
        icon: Target,
        group: "Navigate",
        action: go("/", onClose, router.push),
      },
    ],
    [onClose, onOpenVoice, router]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter(
      (command) =>
        command.title.toLowerCase().includes(term) ||
        command.subtitle.toLowerCase().includes(term)
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        const command = filtered[activeIndex];
        if (command) {
          event.preventDefault();
          void command.action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, filtered, activeIndex, onClose]);

  if (!isOpen) return null;

  const groups: Array<Command["group"]> = ["Actions", "Navigate"];

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[rgba(11,47,36,0.42)] p-4 pt-[12vh] backdrop-blur-[2px] animate-fade-in">
      <div aria-hidden="true" className="absolute inset-0" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop animate-scale-in"
      >
        <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.9} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commitments, missions, or anything..."
            aria-label="Search commands"
            className="h-8 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted"
          />
          <IconButton label="Close command palette" onClick={onClose}>
            <X className="h-4 w-4" strokeWidth={1.9} />
          </IconButton>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-ink-muted">
              No matching commands. Try &ldquo;missions&rdquo; or &ldquo;blind spots&rdquo;.
            </p>
          ) : (
            groups.map((group) => {
              const items = filtered.filter((command) => command.group === group);
              if (items.length === 0) return null;

              return (
                <div key={group}>
                  <p className="px-3 pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    {group}
                  </p>
                  <ul>
                    {items.map((command) => {
                      const index = filtered.indexOf(command);
                      const Icon = command.icon;
                      const active = index === activeIndex;

                      return (
                        <li key={command.id}>
                          <button
                            type="button"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => void command.action()}
                            className={cn(
                              "flex w-full items-center gap-3.5 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-150 ease-out",
                              active ? "bg-brand-pale" : "hover:bg-surface-sunken"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border",
                                active
                                  ? "border-brand-light bg-surface text-brand"
                                  : "border-line bg-surface-muted text-ink-secondary"
                              )}
                            >
                              <Icon className="h-4 w-4" strokeWidth={1.8} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-medium text-ink">
                                {command.title}
                              </span>
                              <span className="block truncate text-[12px] text-ink-muted">
                                {command.subtitle}
                              </span>
                            </span>
                            {active ? (
                              <ArrowRight className="h-3.5 w-3.5 text-brand" strokeWidth={2} />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line-subtle bg-surface-muted px-4 py-2.5 text-[11px] text-ink-muted">
          <span>Navigate ↑ ↓ · Select ⏎</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};
