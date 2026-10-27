"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  User,
  Shield,
  Mic,
  Info,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  SunMoon,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { isAuthenticated, clearSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const AUTONOMY_LEVELS = [
  { level: 0, label: "Ask at each step", description: "Preference saved to your profile." },
  { level: 1, label: "Suggestions first", description: "Preference saved to your profile." },
  { level: 2, label: "Prefer reversible work", description: "Preference saved to your profile." },
  { level: 3, label: "Balanced review", description: "Preference saved to your profile." },
  { level: 4, label: "Review exceptions", description: "Preference saved to your profile." },
  { level: 5, label: "Review summaries", description: "Preference saved to your profile." },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    staleTime: 5 * 60 * 1000,
  });

  const [fullName, setFullName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [autonomy, setAutonomy] = useState(3);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [preferredVoice, setPreferredVoice] = useState("NVIDIA-Parakeet-English");

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setTimezone(user.timezone_pref);
      setAutonomy(user.autonomy_level);
      setVoiceEnabled(user.voice_enabled);
      setPreferredVoice(user.preferred_voice);
    }
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateMe({
        full_name: fullName,
        timezone_pref: timezone,
        autonomy_level: autonomy,
        voice_enabled: voiceEnabled,
        preferred_voice: preferredVoice,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast({ title: "Settings saved", description: "Your preferences are up to date." });
    },
    onError: () =>
      toast({
        title: "Could not save settings",
        description: "The server rejected the change.",
        tone: "danger",
      }),
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => api.checkHealth(),
    staleTime: 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return <LoadingState label="Loading settings" rows={4} />;
  }

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Preferences & control"
        title="Settings"
        description="Manage account preferences and inspect the integrations available in this build."
        icon={<Settings className="h-5 w-5" strokeWidth={1.75} />}
        meta={
          <>
            <Badge tone="brand" dot>Level {autonomy}</Badge>
            <Badge tone={voiceEnabled ? "success" : "neutral"}>{voiceEnabled ? "Voice on" : "Voice off"}</Badge>
          </>
        }
      />

      {/* Profile */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-light bg-brand-pale text-brand-deep">
            <User className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Profile</h2>
            <p className="text-[12.5px] text-ink-secondary">
              {user?.email} · Member since {user ? formatDate(user.created_at) : "—"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="full_name">
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </Field>
          <Field label="Timezone" htmlFor="timezone" hint="Used for deadlines and Resolve Day.">
            <Input
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Kolkata"
            />
          </Field>
        </div>
      </Card>

      {/* Autonomy */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-light bg-brand-pale text-brand-deep">
            <Shield className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Autonomy level</h2>
            <p className="text-[12.5px] text-ink-secondary">
              A saved preference for future workflows. It does not grant execution permissions.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {AUTONOMY_LEVELS.map((item) => (
            <button
              key={item.level}
              type="button"
              onClick={() => setAutonomy(item.level)}
              className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                autonomy === item.level
                  ? "border-brand bg-brand-pale"
                  : "border-line-subtle bg-surface-muted hover:border-line"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                      autonomy === item.level
                        ? "bg-brand text-white"
                        : "bg-surface-sunken text-ink-muted"
                    }`}
                  >
                    {item.level}
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-ink">{item.label}</p>
                    <p className="text-[12px] text-ink-secondary">{item.description}</p>
                  </div>
                </div>
                {autonomy === item.level && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" strokeWidth={2} />
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-warning-light bg-warning-light/50 p-3.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.8} />
            <p className="text-[12.5px] leading-relaxed text-warning">
              External action handlers are not connected. Approval records a decision only and does not execute or verify an action.
            </p>
          </div>
        </div>
      </Card>

      {/* Voice */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-light bg-brand-pale text-brand-deep">
            <Mic className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="flex-1">
            <h2 className="text-[15px] font-semibold text-ink">Voice interface</h2>
            <p className="text-[12.5px] text-ink-secondary">
              Browser speech depends on the device and network. Optional NVIDIA transcription uploads audio only when selected in Hanni; spoken replies use your browser.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={voiceEnabled}
            onClick={() => setVoiceEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              voiceEnabled ? "bg-brand" : "bg-line-strong"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                voiceEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="mt-5">
          <Field label="Preferred voice" htmlFor="voice">
            <Input
              id="voice"
              value={preferredVoice}
              onChange={(e) => setPreferredVoice(e.target.value)}
              disabled={!voiceEnabled}
            />
          </Field>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-sunken text-ink-muted">
              <SunMoon className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Appearance</h2>
              <p className="text-[12.5px] text-ink-secondary">
                Switch between light and dark. Dark is the primary CONVIA identity.
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </Card>

      {/* System */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-light bg-brand-pale text-brand-deep">
            <Info className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">System status</h2>
            <p className="text-[12.5px] text-ink-secondary">Live API health.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge tone={health?.status === "HEALTHY" ? "success" : "warning"} dot>
            {health?.status || "Checking…"}
          </Badge>
          <span className="text-[12.5px] text-ink-secondary">{health?.product}</span>
        </div>
      </Card>

      {/* Session */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-sunken text-ink-muted">
              <LogOut className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Session</h2>
              <p className="text-[12.5px] text-ink-secondary">
                {isAuthenticated()
                ? "You are signed in. Signing out clears this browser's token."
                  : "Sign in to open your private workspace."}
              </p>
            </div>
          </div>
          {isAuthenticated() ? (
            <Button
              variant="outline"
              onClick={() => {
                clearSession();
                queryClient.clear();
                toast({ title: "Signed out", description: "Local session cleared." });
                router.push("/login");
              }}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.8} />
              Sign out
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
