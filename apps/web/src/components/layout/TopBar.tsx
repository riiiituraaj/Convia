"use client";

import React from "react";
import Link from "next/link";
import { Menu, Mic, Play, Search } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { SearchCommand } from "@/components/ui/SearchCommand";
import { cn } from "@/lib/utils";

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

/** Application top bar: command centre, continuity watcher and identity. */
export const TopBar: React.FC<TopBarProps> = ({
  onOpenCommand,
  onOpenVoice,
  onOpenMenu,
  onSeedDemo,
  seeding = false,
  seedSuccess = false,
  userName,
  userEmail,
}) => (
  <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-xl">
    <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 lg:px-8">
      {/* Mobile brand + navigation trigger */}
      <div className="flex items-center gap-1.5 lg:hidden">
        <IconButton label="Open navigation" onClick={onOpenMenu}>
          <Menu className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </IconButton>
        <Link href="/life" aria-label="CONVIA home">
          <LogoMark height={22} />
        </Link>
      </div>

      {/* Continuity watcher */}
      <div className="hidden items-center gap-2 lg:flex">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-light bg-brand-pale px-3 py-1 text-[12px] font-medium text-brand-mid">
          <span className="h-2 w-2 rounded-full bg-brand-accent animate-pulse-soft" />
          Continuity: active &amp; watching
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <SearchCommand
          onClick={onOpenCommand}
          placeholder="Search anything..."
          className="hidden w-[210px] lg:flex xl:w-[290px]"
        />
        <IconButton label="Search" variant="outline" onClick={onOpenCommand} className="lg:hidden">
          <Search className="h-4 w-4" strokeWidth={1.9} />
        </IconButton>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenVoice}
          className="hidden sm:inline-flex"
        >
          <Mic className="h-3.5 w-3.5 text-brand-accent" strokeWidth={1.9} />
          <span className="hidden md:inline">Talk to Convia</span>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onSeedDemo}
          loading={seeding}
          className={cn("hidden xl:inline-flex", seedSuccess && "bg-brand-light")}
        >
          <Play className="h-3.5 w-3.5" strokeWidth={1.9} />
          {seedSuccess ? "Demo loaded" : "Flagship demo"}
        </Button>

        <Link
          href="/settings"
          aria-label="Account and settings"
          className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 transition-colors duration-150 ease-out hover:border-line-strong hover:bg-surface-muted"
        >
          <Avatar name={userName} size="sm" />
          <span className="hidden leading-tight md:block">
            <span className="block max-w-[120px] truncate text-[12px] font-medium text-ink">
              {userName ?? "Continuity user"}
            </span>
            <span className="block max-w-[120px] truncate text-[10.5px] text-ink-muted">
              {userEmail ?? "Account"}
            </span>
          </span>
        </Link>
      </div>
    </div>
  </header>
);
