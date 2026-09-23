"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, Mic, Sparkles, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { OrbState } from "./VoiceOrb";

const selectHanniVoice = (voices: SpeechSynthesisVoice[]) => {
  const preferred = ["Samantha", "Ava", "Karen", "Zira", "Google UK English Female", "Microsoft Jenny"];
  return (
    voices.find((voice) => preferred.some((name) => voice.name.toLowerCase().includes(name.toLowerCase()))) ??
    voices.find((voice) => /female|woman|samantha|ava|karen|zira|jenny/i.test(voice.name)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
  );
};

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommitmentCreated?: () => void;
}

const ORB_TONE: Record<OrbState, string> = {
  IDLE: "border-line bg-surface-sunken text-ink-muted",
  LISTENING: "border-brand-light bg-brand-pale text-brand",
  THINKING: "border-brand-light bg-brand-pale text-brand-mid",
  WORKING: "border-brand-light bg-brand-pale text-brand",
  SPEAKING: "border-brand-light bg-convia-soft text-brand-deep",
  ERROR: "border-[#F8D4D4] bg-danger-light text-danger",
};

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onCommitmentCreated,
}) => {
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [orbState, setOrbState] = useState<OrbState>("IDLE");
  const [statusMessage, setStatusMessage] = useState("Listening for your intent...");
  const [ttsMode, setTtsMode] = useState<"browser" | "none">("browser");
  const [sttMode, setSttMode] = useState<"browser" | "server" | "unavailable">("browser");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = React.useRef<any>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && isOpen) {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.lang = "en-US";

        recog.onstart = () => {
          setOrbState("LISTENING");
          setStatusMessage("Speak naturally. Hanni is listening...");
        };

        recog.onresult = (event: any) => {
          let text = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            text += event.results[i][0].transcript;
          }
          setTranscript(text);
        };

        recog.onerror = () => {
          setOrbState("IDLE");
          setStatusMessage("Microphone paused. You can also type below.");
        };

        recog.onend = () => {
          setOrbState("IDLE");
        };

        recognitionRef.current = recog;
        try {
          recog.start();
        } catch (error) {
          // Already started, or microphone permission not granted yet.
        }
      } else {
        setSttMode("server");
        setStatusMessage("Web Speech unavailable — use Record for server ASR, or type below.");
      }
    }

    if (typeof window !== "undefined" && !("speechSynthesis" in window)) {
      setTtsMode("none");
    }

    return () => {
      const active = recognitionRef.current;
      if (active) {
        try {
          active.stop();
        } catch (error) {
          // Ignore stop failures during unmount.
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen]);

  const startServerRecording = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setSttMode("unavailable");
      setStatusMessage("Microphone unavailable. Type your intent below.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setOrbState("THINKING");
        setStatusMessage("Transcribing with server ASR…");
        try {
          const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
          const result = await api.transcribeAudio(blob, mime === "audio/mp4" ? "audio.m4a" : "audio.webm");
          if (result.transcript) {
            setTranscript(result.transcript);
            setSttMode(result.provider?.toLowerCase().includes("browser") ? "browser" : "server");
            setStatusMessage("Transcript ready. Process the intent when you are set.");
            setOrbState("IDLE");
          } else {
            setSttMode("unavailable");
            setOrbState("IDLE");
            setStatusMessage(result.message || result.error || "Server ASR unavailable — type your intent.");
          }
        } catch {
          setSttMode("unavailable");
          setOrbState("ERROR");
          setStatusMessage("Server transcription failed. Type your intent below.");
        }
      };

      recorder.start();
      setIsRecording(true);
      setOrbState("LISTENING");
      setStatusMessage("Recording… speak clearly, then stop.");
    } catch {
      setSttMode("unavailable");
      setStatusMessage("Microphone permission denied. Type your intent below.");
    }
  };

  const stopServerRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleProcessIntent = async (textToProcess?: string) => {
    const text = textToProcess || transcript;
    if (!text.trim()) return;

    try {
      setOrbState("THINKING");
      setStatusMessage("Hanni is thinking through your next step...");

      const voiceResult = await api.respondToVoice(text);
      setResponse(voiceResult.text_response);
      setProviderUsed(voiceResult.provider_used ?? null);

      setOrbState("WORKING");
      setStatusMessage("Extracting commitments and updating the continuity loop...");
      await api.parseIntent(text, "voice");

      if (
        voiceResult.audio_url &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        // Server TTS URL not part of current browser flow — fall through to browser voice.
        setTtsMode("browser");
      }

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(voiceResult.text_response);
        const speak = () => {
          const voice = selectHanniVoice(window.speechSynthesis.getVoices());
          if (voice) utterance.voice = voice;
          utterance.rate = 0.88;
          utterance.pitch = 1.08;
          utterance.volume = 0.86;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        };
        setOrbState("SPEAKING");
        setTtsMode("browser");
        utterance.onend = () => setOrbState("IDLE");
        if (window.speechSynthesis.getVoices().length) {
          speak();
        } else {
          window.speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
        }
      } else {
        setTtsMode("none");
        setOrbState("IDLE");
      }

      setStatusMessage("Hanni captured the thread and updated your continuity surface.");
      if (onCommitmentCreated) onCommitmentCreated();
    } catch (error) {
      console.error("Voice processing error", error);
      setOrbState("ERROR");
      setStatusMessage("Could not complete the reasoning request.");
    }
  };

  const handleQuickDemoPrompt = () => {
    const flagshipText =
      "CONVIA, I start my internship in Bangalore in 21 days. I need housing, travel, documents, and I promised my team I would finish the API tonight. Keep everything on track and keep me under ₹80,000.";
    setTranscript(flagshipText);
    handleProcessIntent(flagshipText);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hanni"
      subtitle="Your soft-spoken continuity assistant"
      eyebrow="Voice continuity"
      icon={<Mic className="h-4 w-4" strokeWidth={1.8} />}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={handleQuickDemoPrompt}>
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
            Use flagship prompt
          </Button>
          <Button size="md" onClick={() => handleProcessIntent()} disabled={!transcript.trim()}>
            Process intent
            <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-xl border border-line bg-surface-muted p-4">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
              ORB_TONE[orbState]
            )}
          >
            <Mic
              className={cn("h-5 w-5", orbState === "LISTENING" && "animate-pulse")}
              strokeWidth={1.8}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={orbState === "ERROR" ? "danger" : orbState === "IDLE" ? "neutral" : "success"}
                dot
                label={orbState === "IDLE" ? "Ready" : orbState.toLowerCase()}
              />
              {sttMode === "server" ? (
                <Button
                  size="sm"
                  variant={isRecording ? "danger" : "outline"}
                  onClick={isRecording ? stopServerRecording : startServerRecording}
                >
                  {isRecording ? "Stop recording" : "Record (server ASR)"}
                </Button>
              ) : null}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
              {statusMessage}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="voice-transcript"
            className="block text-[12px] font-medium uppercase tracking-[0.08em] text-ink-secondary"
          >
            Transcript / prompt
          </label>
          <Textarea
            id="voice-transcript"
            rows={4}
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Say or type your commitments, obligations, or goals..."
          />
        </div>

        {response ? (
          <div className="rounded-xl border border-brand-light bg-brand-pale p-4 animate-fade-in-up">
            <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-brand-mid">
              <Volume2 className="h-3.5 w-3.5" strokeWidth={2} />
              Hanni&apos;s response
              {providerUsed ? (
                <span
                  className={
                    /local-deterministic|fallback/i.test(providerUsed)
                      ? "ml-auto rounded-full border border-[#F7E2B8] bg-warning-light px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[#B87A0E]"
                      : "ml-auto rounded-full border border-brand-light bg-white/70 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-brand-mid"
                  }
                  title={
                    /local-deterministic|fallback/i.test(providerUsed)
                      ? "No live LLM API key — deterministic local reply"
                      : "Live model"
                  }
                >
                  {/local-deterministic|fallback/i.test(providerUsed) ? "Local mode" : providerUsed}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">{response}</p>
            {providerUsed && /local-deterministic|fallback/i.test(providerUsed) ? (
              <p className="mt-1.5 text-[11.5px] text-ink-muted">
                Model: {providerUsed} — add NVIDIA/Nebius credentials for full CONVIA AI.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-line-subtle bg-surface-muted p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Speech pipeline
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-ink-secondary">
            <li>
              Listening:{" "}
              <span className="font-medium text-ink">
                {sttMode === "browser"
                  ? "Browser Web Speech API"
                  : sttMode === "server"
                    ? "Server ASR via MediaRecorder → POST /voice/transcribe"
                    : "Unavailable — type instead"}
              </span>
            </li>
            <li>
              Speaking:{" "}
              <span className="font-medium text-ink">
                {ttsMode === "browser"
                  ? "Browser speech synthesis"
                  : "Unavailable — read the reply"}
              </span>
            </li>
            <li>
              NVIDIA Parakeet:{" "}
              <span className="font-medium text-warning">Coming Soon</span>
              <span className="text-ink-muted">
                {" "}
                — /voice/transcribe is wired; needs NVIDIA credentials for live ASR.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
