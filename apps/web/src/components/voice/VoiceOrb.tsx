"use client";

import React from "react";
import { AlertCircle, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrbState = "IDLE" | "LISTENING" | "THINKING" | "WORKING" | "SPEAKING" | "ERROR";

interface VoiceOrbProps {
  state: OrbState;
  onClick: () => void;
  className?: string;
}

const VISUALS: Record<
  OrbState,
  { ring: string; core: string; label: string; halo: string }
> = {
  IDLE: {
    ring: "border-brand-light",
    core: "from-brand-accent to-brand-mid",
    halo: "shadow-[0_8px_28px_rgba(18,63,48,0.28)]",
    label: "Tap to speak",
  },
  LISTENING: {
    ring: "border-brand-accent animate-ping",
    core: "from-brand-accent to-emerald-400",
    halo: "shadow-[0_10px_34px_rgba(37,168,102,0.45)]",
    label: "Listening",
  },
  THINKING: {
    ring: "border-brand-mid",
    core: "from-brand-mid to-brand",
    halo: "shadow-[0_10px_34px_rgba(36,98,71,0.4)]",
    label: "Reasoning",
  },
  WORKING: {
    ring: "border-brand-accent",
    core: "from-brand-accent to-brand-mid",
    halo: "shadow-[0_10px_34px_rgba(37,168,102,0.4)]",
    label: "Working",
  },
  SPEAKING: {
    ring: "border-brand-light",
    core: "from-brand-light to-brand-accent",
    halo: "shadow-[0_10px_34px_rgba(37,168,102,0.5)]",
    label: "Speaking",
  },
  ERROR: {
    ring: "border-[#F8D4D4]",
    core: "from-danger to-[#C73232]",
    halo: "shadow-[0_10px_30px_rgba(240,68,68,0.35)]",
    label: "Voice error",
  },
};

/** Persistent voice control. Sits above the mobile navigation bar. */
export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, onClick, className }) => {
  const visuals = VISUALS[state] ?? VISUALS.IDLE;

  return (
    <div
      className={cn(
        "fixed bottom-[136px] right-4 z-40 hidden items-center gap-2.5 sm:flex lg:bottom-6 lg:right-6",
        className
      )}
    >
      {state !== "IDLE" ? (
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-ink-secondary shadow-card animate-fade-in">
          {visuals.label}
        </span>
      ) : null}

      <button
        type="button"
        onClick={onClick}
        aria-label="Activate Hanni voice assistant"
        className={cn(
          "relative flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-200 ease-out active:scale-95",
          visuals.halo
        )}
      >
        <span
          className={cn(
            "absolute inset-0 rounded-full border transition-all duration-500",
            visuals.ring
          )}
        />
        <span
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br p-[2px]",
            visuals.core
          )}
        >
          <span className="flex h-full w-full items-center justify-center rounded-full bg-surface">
            {state === "ERROR" ? (
              <AlertCircle className="h-6 w-6 text-danger" strokeWidth={1.8} />
            ) : (
              <Mic
                className={cn(
                  "h-5 w-5",
                  state === "LISTENING"
                    ? "animate-pulse text-brand-accent"
                    : "text-brand-deep"
                )}
                strokeWidth={1.8}
              />
            )}
          </span>
        </span>
      </button>
    </div>
  );
};
