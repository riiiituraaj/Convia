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

const speechRecognitionErrorMessage = (error: string) => {
  switch (error) {
    case "not-allowed":
      return "The browser blocked microphone or speech access. Check site and Windows microphone permissions.";
    case "service-not-allowed":
      return "The browser speech service is blocked or unavailable. Check browser settings or try Chrome/Edge.";
    case "audio-capture":
      return "The browser cannot access a microphone input. Check the selected input device and Windows privacy settings.";
    case "network":
      return "The browser speech service could not be reached. Check your internet connection, VPN, or firewall.";
    case "no-speech":
      return "No speech was detected. Check the selected microphone, then try speaking again after Listen starts.";
    case "language-not-supported":
      return "This browser speech service does not support the selected language (English US).";
    case "aborted":
      return "Listening was interrupted. Press Listen to try again.";
    default:
      return "Browser speech stopped. Check microphone access and try again, or type below.";
  }
};

const recordedAudioToWav = async (recording: Blob): Promise<Blob> => {
  const sourceContext = new AudioContext();
  try {
    const decoded = await sourceContext.decodeAudioData(await recording.arrayBuffer());
    const sampleRate = 16_000;
    const frameCount = Math.max(1, Math.ceil(decoded.duration * sampleRate));
    const outputContext = new OfflineAudioContext(1, frameCount, sampleRate);
    const source = outputContext.createBufferSource();
    source.buffer = decoded;
    source.connect(outputContext.destination);
    source.start();
    const mono = await outputContext.startRendering();
    const samples = mono.getChannelData(0);
    const wav = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(wav);
    const writeText = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
    };

    writeText(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeText(8, "WAVE");
    writeText(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, "data");
    view.setUint32(40, samples.length * 2, true);
    for (let index = 0; index < samples.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index]));
      view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return new Blob([wav], { type: "audio/wav" });
  } finally {
    await sourceContext.close();
  }
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
  const [statusMessage, setStatusMessage] = useState("Voice input ready.");
  const [ttsMode, setTtsMode] = useState<"browser" | "none">("browser");
  const [sttMode, setSttMode] = useState<"browser" | "unavailable">("unavailable");
  const [isListening, setIsListening] = useState(false);
  const [isServerRecording, setIsServerRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = React.useRef<any>(null);
  const speechFailedRef = React.useRef(false);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const recordingChunksRef = React.useRef<Blob[]>([]);
  const recordingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && isOpen) {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        setSttMode("browser");
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.lang = "en-US";

        recog.onstart = () => {
          speechFailedRef.current = false;
          setOrbState("LISTENING");
          setStatusMessage("Speak naturally. Hanni is listening...");
        };

        recog.onresult = (event: any) => {
          let text = "";
          for (let i = 0; i < event.results.length; ++i) {
            text += event.results[i][0].transcript;
          }
          setTranscript(text);
        };

        recog.onerror = (event: any) => {
          speechFailedRef.current = true;
          setIsListening(false);
          setOrbState("IDLE");
          const error = typeof event.error === "string" ? event.error : "unknown";
          setStatusMessage(`${speechRecognitionErrorMessage(error)} (Error: ${error})`);
        };

        recog.onend = () => {
          setIsListening(false);
          setOrbState("IDLE");
          if (!speechFailedRef.current) {
            setStatusMessage("Listening stopped. Review the transcript, then choose Process intent.");
          }
        };

        recognitionRef.current = recog;
        setStatusMessage("Browser speech is ready. Press Listen to start, or type below.");
      } else {
        setSttMode("unavailable");
        setStatusMessage("Browser speech is unavailable. Use NVIDIA recording or type below.");
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
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        try {
          recorder.stop();
        } catch {
          // Ignore stop failures during unmount.
        }
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, [isOpen]);

  const startBrowserListening = () => {
    if (!recognitionRef.current || sttMode !== "browser") return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setStatusMessage("Microphone could not start. Check browser permission, or type below.");
    }
  };

  const stopBrowserListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        setIsListening(false);
      }
    }
  };

  const stopServerRecording = () => {
    const recorder = recorderRef.current;
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (recorder && recorder.state === "recording") recorder.stop();
  };

  const startServerRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatusMessage("Audio recording is not supported in this browser. Use Listen or type below.");
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find(
        (candidate) => MediaRecorder.isTypeSupported(candidate)
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      mediaStreamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
        stream?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setIsServerRecording(false);
        setOrbState("ERROR");
        setStatusMessage("Audio recording failed. Check the selected microphone, or use Listen or type below.");
      };
      recorder.onstop = () => {
        if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
        stream?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setIsServerRecording(false);
        setIsTranscribing(true);
        setOrbState("THINKING");
        setStatusMessage("Converting the recording to WAV before sending it for transcription…");

        void (async () => {
          try {
            const recording = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
            if (!recording.size) throw new Error("No audio was recorded.");
            const wav = await recordedAudioToWav(recording);
            setStatusMessage("Sending the recording to NVIDIA for transcription…");
            const result = await api.transcribeAudio(wav, "voice.wav");
            if (!result.transcript?.trim()) {
              setOrbState("ERROR");
              setStatusMessage(result.message || "NVIDIA returned no transcript. Try a clearer recording.");
              return;
            }
            setTranscript((current) => current.trim()
              ? `${current.trim()} ${result.transcript.trim()}`
              : result.transcript.trim());
            setOrbState("IDLE");
            setStatusMessage("NVIDIA transcript ready. Review it, then choose Process intent.");
          } catch (error) {
            setOrbState("ERROR");
            setStatusMessage(
              error instanceof Error
                ? `Server transcription failed. ${error.message}`
                : "Server transcription failed. Check the API connection and try again."
            );
          } finally {
            setIsTranscribing(false);
          }
        })();
      };

      recorder.start();
      setIsServerRecording(true);
      setOrbState("LISTENING");
      setStatusMessage("Recording for NVIDIA transcription. Stop when you finish speaking.");
      recordingTimeoutRef.current = setTimeout(() => {
        setStatusMessage("Recording limit reached. Transcribing now…");
        if (recorder.state === "recording") recorder.stop();
      }, 60_000);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      setIsServerRecording(false);
      setOrbState("ERROR");
      setStatusMessage(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow it in the browser and Windows settings, or type below."
          : "Could not start audio recording. Check your microphone input, or use Listen or type below."
      );
    }
  };

  const speakResponse = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setTtsMode("none");
      setStatusMessage("Browser speech playback is unavailable. Read the reply below.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const speak = () => {
      const voice = selectHanniVoice(window.speechSynthesis.getVoices());
      if (voice) utterance.voice = voice;
      utterance.rate = 0.88;
      utterance.pitch = 1.08;
      utterance.volume = 0.86;
      utterance.onend = () => {
        setOrbState("IDLE");
        setStatusMessage("Reply finished. You can replay it below.");
      };
      utterance.onerror = () => {
        setOrbState("IDLE");
        setStatusMessage("Browser could not play the reply. Try Speak reply again, or read it below.");
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setOrbState("SPEAKING");
      setTtsMode("browser");
      setStatusMessage("Speaking reply...");
    };

    if (window.speechSynthesis.getVoices().length) {
      speak();
    } else {
      setStatusMessage("Waiting for a browser voice...");
      window.speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
    }
  };

  const handleProcessIntent = async (textToProcess?: string) => {
    const text = textToProcess || transcript;
    if (!text.trim()) return;

    try {
      setOrbState("WORKING");
      setStatusMessage("Saving your capture…");
      const captureResult = await api.parseIntent(text, "voice");
      const captureSummary =
        captureResult?.summary_message ?? "Your capture was saved. Review it in your workspace.";
      let spokenText = captureSummary;
      let replyReady = false;
      setResponse(captureSummary);
      setProviderUsed("local-capture-summary");

      setOrbState("THINKING");
      setStatusMessage("Capture saved. Preparing an optional AI voice reply…");
      try {
        const voiceResult = await api.respondToVoice(text);
        spokenText = voiceResult.text_response;
        setResponse(voiceResult.text_response);
        setProviderUsed(voiceResult.provider_used ?? null);
        replyReady = true;
      } catch {
        setStatusMessage(
          "Capture saved. The configured AI provider is unavailable, so the saved summary is shown instead."
        );
      }

      setOrbState("IDLE");
      setStatusMessage(
        replyReady
          ? "Capture saved. AI reply is shown below."
          : "Capture saved. Local summary is shown below."
      );
      speakResponse(spokenText);
      if (onCommitmentCreated) onCommitmentCreated();
    } catch (error) {
      console.error("Voice processing error", error);
      setOrbState("ERROR");
      const message =
        error instanceof TypeError && /fetch/i.test(error.message)
          ? "Can't reach the CONVIA API. Start the local API at http://localhost:8000 and retry."
          : error instanceof Error
            ? error.message
            : "Could not save this capture.";
      setStatusMessage(`Capture failed. ${message}`);
    }
  };

  const handleQuickDemoPrompt = () => {
    const flagshipText =
      "CONVIA, I start my internship in Bangalore in 21 days. I need housing, travel, documents, and I promised my team I would finish the API tonight. Keep everything on track and keep me under ₹80,000.";
    setTranscript(flagshipText);
    setResponse("");
    setStatusMessage("Example prompt added. Review it, then choose Process intent to save it.");
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
            Fill example prompt
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
              {sttMode === "browser" ? (
                <Button
                  size="sm"
                  variant={isListening ? "danger" : "outline"}
                  onClick={isListening ? stopBrowserListening : startBrowserListening}
                  disabled={isServerRecording || isTranscribing}
                >
                  <Mic className="mr-1.5 h-3.5 w-3.5" />
                  {isListening ? "Stop listening" : "Listen"}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={isServerRecording ? "danger" : "outline"}
                onClick={isServerRecording ? stopServerRecording : startServerRecording}
                disabled={isTranscribing || (isListening && !isServerRecording)}
              >
                <Mic className="mr-1.5 h-3.5 w-3.5" />
                {isTranscribing
                  ? "Transcribing…"
                  : isServerRecording
                    ? "Stop & transcribe"
                    : "Record with NVIDIA"}
              </Button>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
              {statusMessage}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              Choosing Record with NVIDIA uploads the recording through CONVIA&apos;s API to NVIDIA for transcription.
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
              {ttsMode === "browser" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => speakResponse(response)}
                  className="ml-auto normal-case tracking-normal"
                >
                  <Volume2 className="mr-1.5 h-3.5 w-3.5" />
                  Speak reply
                </Button>
              ) : null}
              {providerUsed ? (
                <span
                  className={
                    /local-deterministic|fallback|local-capture-summary/i.test(providerUsed)
                      ? "ml-auto rounded-full border border-[#F7E2B8] bg-warning-light px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-warning"
                      : "ml-auto rounded-full border border-brand-light bg-surface px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-brand-mid"
                  }
                  title={
                    /local-capture-summary/i.test(providerUsed)
                      ? "Saved capture summary; no AI voice response was available"
                      : /local-deterministic|fallback/i.test(providerUsed)
                        ? "Deterministic local reply; no live model response"
                      : "Live model"
                  }
                >
                  {/local-deterministic|fallback|local-capture-summary/i.test(providerUsed)
                    ? "Local mode"
                    : providerUsed}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">{response}</p>
            {providerUsed && /local-capture-summary/i.test(providerUsed) ? (
              <p className="mt-1.5 text-[11.5px] text-ink-muted">
                This is the saved capture summary, not an AI generated reply.
              </p>
            ) : providerUsed && /local-deterministic|fallback/i.test(providerUsed) ? (
              <p className="mt-1.5 text-[11.5px] text-ink-muted">
                Model: {providerUsed} — check the selected provider configuration for a live model reply.
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
                  ? "Browser speech recognition available"
                  : "Browser recognition unavailable — use NVIDIA recording or type"}
              </span>
            </li>
            <li>
              Speaking:{" "}
              <span className="font-medium text-ink">
                {ttsMode === "browser"
                  ? "Browser speech synthesis available"
                  : "Unavailable — read the reply"}
              </span>
            </li>
            <li>Server ASR: optional NVIDIA transcription. Audio is sent only when you choose Record with NVIDIA.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
