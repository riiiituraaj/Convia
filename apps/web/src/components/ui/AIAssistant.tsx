"use client";

import React, { useState } from "react";
import { ArrowUp, CheckCircle2, Loader2, Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./Button";
import { Textarea } from "./Input";
import { Card, CardHeader } from "./Card";
import { StatusBadge } from "./Badge";

export interface AIAssistantProps {
  /** Sends the prompt to the assistant and resolves with its answer (or text + provider). */
  onAsk: (prompt: string) => Promise<string | { text: string; provider?: string }>;
  /** Optional capture step that turns the prompt into real commitments. */
  onCapture?: (prompt: string) => Promise<string>;
  suggestions?: string[];
  className?: string;
  placeholder?: string;
}

/**
 * CONVIA AI Assistant panel — part of the product surface, not a bolted-on chat.
 */
export const AIAssistant: React.FC<AIAssistantProps> = ({
  onAsk,
  onCapture,
  suggestions = [],
  className,
  placeholder = "Ask anything about your goals, commitments or next steps...",
}) => {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [askState, setAskState] = useState<"idle" | "asking" | "done" | "error">("idle");
  const [captureState, setCaptureState] = useState<"idle" | "capturing" | "done" | "error">("idle");
  const [lastPrompt, setLastPrompt] = useState("");

  const isLocalProvider = (value: string | null | undefined) =>
    Boolean(value && /local-deterministic|fallback/i.test(value));

  const runAsk = async (value: string) => {
    const text = value.trim();
    if (!text || askState === "asking") return;

    setLastPrompt(text);
    setAnswer("");
    setProvider(null);
    setCaptureState("idle");
    setAskState("asking");

    try {
      const result = await onAsk(text);
      if (typeof result === "string") {
        setAnswer(result);
      } else {
        setAnswer(result.text);
        setProvider(result.provider ?? null);
      }
      setAskState("done");
    } catch {
      setAskState("error");
    }
  };

  const runCapture = async () => {
    if (!onCapture || !lastPrompt) return;
    setCaptureState("capturing");
    try {
      setAnswer(await onCapture(lastPrompt));
      setCaptureState("done");
    } catch {
      setCaptureState("error");
    }
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader
        icon={<Sparkles className="h-4 w-4" strokeWidth={1.8} />}
        title="AI Assistant"
        subtitle={
          provider
            ? isLocalProvider(provider)
              ? `Local mode · ${provider}`
              : `Live model · ${provider}`
            : "Powered by CONVIA"
        }
        action={
          <StatusBadge
            tone={
              askState === "asking"
                ? "warning"
                : provider && isLocalProvider(provider)
                  ? "warning"
                  : "success"
            }
            dot
            label={
              askState === "asking"
                ? "Thinking"
                : provider && isLocalProvider(provider)
                  ? "Local"
                  : "Ready"
            }
          />
        }
      />
      <div className="space-y-4 px-5 py-4 sm:px-6">
        <div className="relative">
          <Textarea
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void runAsk(prompt);
              }
            }}
            placeholder={placeholder}
            className="pr-12"
            aria-label="Ask CONVIA AI"
          />
          <IconButton
            label="Send prompt"
            variant="secondary"
            onClick={() => void runAsk(prompt)}
            disabled={!prompt.trim() || askState === "asking"}
            className="absolute bottom-2.5 right-2.5"
          >
            {askState === "asking" ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            )}
          </IconButton>
        </div>

        {(answer || askState === "asking" || askState === "error") && (
          <div
            className={cn(
              "rounded-xl border p-4 animate-fade-in-up",
              askState === "error"
                ? "border-[#F8D4D4] bg-danger-light"
                : "border-brand-light bg-brand-pale"
            )}
          >
            <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-brand-mid">
              {askState === "asking" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {askState === "error"
                ? "Assistant unavailable"
                : provider && isLocalProvider(provider)
                  ? "Local continuity engine"
                  : "CONVIA AI"}
              {provider && isLocalProvider(provider) && askState === "done" ? (
                <span className="ml-auto rounded-full border border-[#F7E2B8] bg-warning-light px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[#B87A0E]">
                  No API key
                </span>
              ) : null}
            </div>

            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
              {askState === "asking"
                ? "Reading your commitments, missions and blind spots..."
                : askState === "error"
                  ? "The reasoning service did not respond. Nothing was changed — try again in a moment."
                  : answer}
            </p>

            {onCapture && askState === "done" && captureState !== "done" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={runCapture}
                  loading={captureState === "capturing"}
                >
                  <Wand2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                  Capture as commitments
                </Button>
                {captureState === "error" ? (
                  <span className="text-[12px] text-danger">
                    Capture failed. Nothing was changed.
                  </span>
                ) : null}
              </div>
            ) : null}

            {captureState === "done" ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-mid">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                Added to your continuity surface.
              </p>
            ) : null}
          </div>
        )}

        {suggestions.length > 0 ? (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Suggested actions
            </p>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setPrompt(suggestion);
                  void runAsk(suggestion);
                }}
                className="flex w-full items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 py-2 text-left text-[13px] text-ink-secondary transition-colors duration-150 ease-out hover:border-line hover:bg-surface-sunken hover:text-ink"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-accent" strokeWidth={1.9} />
                <span className="truncate">{suggestion}</span>
              </button>
            ))}
          </div>
        ) : null}

      </div>
    </Card>
  );
};
