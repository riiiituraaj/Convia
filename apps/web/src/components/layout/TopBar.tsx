"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Command, LoaderCircle, Menu, Mic, Search, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export interface TopBarProps {
  onOpenCommand: () => void;
  onOpenVoice: () => void;
  onOpenMenu: () => void;
  onSeedDemo: () => void;
  seeding?: boolean;
  seedSuccess?: boolean;
  userName?: string;
  userEmail?: string;
}

/** The global natural-language capture form and account controls. */
export const TopBar: React.FC<TopBarProps> = ({
  onOpenCommand,
  onOpenVoice,
  onOpenMenu,
  userName,
  userEmail,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [task, setTask] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fillTask = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (typeof value !== "string") return;
      setTask(value);
      window.requestAnimationFrame(() => document.getElementById("global-task")?.focus());
    };
    window.addEventListener("convia:fill-task", fillTask);
    return () => window.removeEventListener("convia:fill-task", fillTask);
  }, []);

  const submitTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = task.trim();
    if (!value || submitting) return;

    setSubmitting(true);
    try {
      const result = await api.parseIntent(value, "text");
      setTask("");
      ["commitments", "missions", "blindSpots", "agentRuns", "people", "waiting", "risks", "actions"].forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: [key] });
      });
      toast({
        title: "Saved to your workspace",
        description: result.summary_message,
        tone: "success",
      });
    } catch (error) {
      toast({
        title: "Couldn’t capture that yet",
        description: error instanceof Error ? error.message : "Check your connection and try again. Your text is still here.",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex min-h-[76px] max-w-[1720px] items-center gap-3 px-4 sm:px-6 lg:px-7">
        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          <IconButton label="Open navigation" onClick={onOpenMenu} className="h-11 w-11 lg:h-9 lg:w-9">
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </IconButton>
          <Link href="/life" aria-label="CONVIA home"><LogoMark height={22} /></Link>
        </div>

        <form
          onSubmit={submitTask}
          aria-label="Capture an intention"
          className="mx-auto flex h-[50px] min-w-0 max-w-[820px] flex-1 items-center gap-2 rounded-full border border-line bg-surface px-3 shadow-card transition focus-within:border-brand focus-within:shadow-focus sm:px-4"
        >
          <Sparkles aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-brand-mid" strokeWidth={1.8} />
          <label htmlFor="global-task" className="sr-only">What would you like to accomplish today?</label>
          <input
            id="global-task"
            value={task}
            onChange={(event) => setTask(event.target.value)}
            placeholder="What would you like to accomplish today?"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-muted sm:text-[13.5px]"
          />
          <button
            type="button"
            onClick={onOpenCommand}
            aria-label="Open command center"
            title="Open command center"
            className="hidden h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] text-ink-muted transition hover:bg-surface-sunken hover:text-ink-secondary lg:inline-flex"
          >
            <Command className="h-3 w-3" /> K
          </button>
          <IconButton label="Search workspace" variant="ghost" onClick={onOpenCommand} className="hidden h-11 w-11 sm:inline-flex sm:h-9 sm:w-9">
            <Search className="h-4 w-4" strokeWidth={1.8} />
          </IconButton>
          <IconButton label="Use voice input" variant="ghost" onClick={onOpenVoice} className="h-11 w-11 sm:h-9 sm:w-9">
            <Mic className="h-4 w-4 text-brand-mid" strokeWidth={1.8} />
          </IconButton>
          <button
            type="submit"
            disabled={submitting || !task.trim()}
            aria-label={submitting ? "Saving request" : "Submit request"}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-transparent bg-brand text-white shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-sunken disabled:text-ink-disabled disabled:shadow-none"
          >
            {submitting ? <LoaderCircle className="h-[17px] w-[17px] animate-spin" /> : <ArrowUp className="h-[17px] w-[17px]" strokeWidth={2} />}
          </button>
        </form>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary xl:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#88a89c]" /> Private workspace
          </span>
          <Link
            href="/settings"
            aria-label={`Account and settings${userName ? ` for ${userName}` : ""}`}
            className="flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 transition hover:bg-surface-muted"
          >
            <Avatar name={userName} size="sm" />
            <span className="hidden max-w-[128px] leading-tight md:block">
              <span className="block truncate text-[11.5px] font-medium text-ink">{userName ?? "Your account"}</span>
              <span className="block truncate text-[11.5px] text-ink-muted">{userEmail ?? "Settings"}</span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
};
