"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "@/components/command/CommandPalette";
import { VoiceModal } from "@/components/voice/VoiceModal";
import { VoiceOrb, type OrbState } from "@/components/voice/VoiceOrb";
import { useActivityStream } from "@/hooks/useActivityStream";

/**
 * CONVIA application shell: fixed sidebar, sticky top bar, mobile navigation
 * and the global overlays (command centre, voice interface, voice orb).
 */
export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [orbState] = useState<OrbState>("IDLE");

  // Live SSE: keep React Query caches in sync with backend events.
  useActivityStream();

  // Identity comes from the existing API (it auto-provisions the continuity user).
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const handleSeedDemo = useCallback(async () => {
    try {
      setSeeding(true);
      await api.seedFlagshipDemo();
      setSeedSuccess(true);
      window.setTimeout(() => {
        setSeedSuccess(false);
        window.location.reload();
      }, 1200);
    } catch (error) {
      console.error("Demo seeding failed", error);
    } finally {
      setSeeding(false);
    }
  }, []);

  // Global command shortcut (⌘K / Ctrl+K) plus "/" when not typing.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandOpen((open) => !open);
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable === true;

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        setIsCommandOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="app-environment min-h-screen">
      <Sidebar
        userName={user?.full_name}
        userEmail={user?.email}
        onSeedDemo={handleSeedDemo}
        seeding={seeding}
      />

      <Sidebar
        variant="drawer"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        userName={user?.full_name}
        userEmail={user?.email}
        onSeedDemo={handleSeedDemo}
        seeding={seeding}
      />

      <div className="min-h-screen lg:pl-[224px]">
        <TopBar
          onOpenCommand={() => setIsCommandOpen(true)}
          onOpenVoice={() => setIsVoiceOpen(true)}
          onOpenMenu={() => setIsDrawerOpen(true)}
          onSeedDemo={handleSeedDemo}
          seeding={seeding}
          seedSuccess={seedSuccess}
          userName={user?.full_name}
          userEmail={user?.email}
        />

        <main className="mx-auto w-full max-w-[1720px] px-4 pb-32 pt-5 sm:px-6 lg:px-7 lg:pb-12 lg:pt-6">
          {children}
        </main>
      </div>

      <MobileNav
        onOpenMenu={() => setIsDrawerOpen(true)}
        onOpenVoice={() => setIsVoiceOpen(true)}
        onSeedDemo={handleSeedDemo}
      />

      <VoiceOrb state={orbState} onClick={() => setIsVoiceOpen(true)} />

      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onOpenVoice={() => setIsVoiceOpen(true)}
      />

      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onCommitmentCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["commitments"] });
          queryClient.invalidateQueries({ queryKey: ["missions"] });
          queryClient.invalidateQueries({ queryKey: ["agentRuns"] });
          queryClient.invalidateQueries({ queryKey: ["people"] });
          queryClient.invalidateQueries({ queryKey: ["waiting"] });
          queryClient.invalidateQueries({ queryKey: ["risks"] });
          queryClient.invalidateQueries({ queryKey: ["actions"] });
          queryClient.invalidateQueries({ queryKey: ["blindSpots"] });
        }}
      />
    </div>
  );
};
