import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Globe,
  Layers,
  Mic,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const FEATURES = [
  {
    icon: Target,
    title: "Commitment-first",
    description:
      "Capture an obligation, keep its context and deadline visible, and follow its status over time.",
  },
  {
    icon: Shield,
    title: "Human approval layer",
    description:
      "Review proposed actions before they move forward. Approval is recorded separately from execution.",
  },
  {
    icon: Bell,
    title: "Deadline review signals",
    description:
      "See saved commitments awaiting confirmation, user marked risks, and deadlines within 48 hours.",
  },
  {
    icon: Layers,
    title: "Capture and review",
    description:
      "The parser extracts explicit commitments and groups objective phrases. It does not infer dependencies.",
  },
  {
    icon: Globe,
    title: "Honest integrations",
    description:
      "Provider credentials, live connectivity, and unavailable integrations are reported as different states.",
  },
  {
    icon: Mic,
    title: "Voice-first",
    description:
      "Use browser speech recognition where supported. Server-side speech services still require provider configuration.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Capture",
    description: "Submit an objective or a commitment through the authenticated workspace.",
  },
  {
    step: "02",
    title: "Model",
    description: "The current parser captures commitments and a simple objective graph for review.",
  },
  {
    step: "03",
    title: "Review",
    description: "Inspect saved deadlines, confirmations and proposals in your account.",
  },
  {
    step: "04",
    title: "Decide",
    description: "Approve or reject a proposal. The decision is recorded; external execution is not connected.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo height={28} showTagline />
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-ink-secondary hover:text-ink sm:inline"
            >
              Sign in
            </Link>
            <Link
              href="/life"
              className="inline-flex h-9 items-center rounded-[10px] bg-brand px-4 text-sm font-medium text-white hover:bg-brand-deep transition-colors"
            >
              Open app
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-convia-hero opacity-[0.04]" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-light bg-brand-pale px-3 py-1 text-[12px] font-medium text-brand-deep">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
              Personal Continuity Engine
            </span>
            <h1 className="mt-5 text-[40px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[56px]">
              Never lose
              <br />
              <span className="text-brand">the thread.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-secondary sm:text-[17px]">
              CONVIA captures objectives and clearly stated commitments, then helps you review saved missions and deadlines. Built around a single primitive: the{" "}
              <strong className="font-semibold text-ink">Commitment</strong>.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/life"
                className="inline-flex h-11 items-center rounded-[10px] bg-brand px-5 text-[15px] font-medium text-white shadow-[0_1px_2px_rgba(11,47,36,0.18)] hover:bg-brand-deep transition-colors"
              >
                Open the dashboard
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2} />
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 items-center rounded-[10px] border border-line bg-surface px-5 text-[15px] font-medium text-ink hover:bg-surface-sunken transition-colors"
              >
                Create free account
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-ink-muted">
              No credit card · Local deterministic capture · Open source core
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-accent">
            Why CONVIA
          </p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">
            Continuity is the product.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
            Save commitments with the context you provide, then review their status,
            recipients and deadlines in one workspace.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-xl border border-line bg-surface p-5 shadow-card hover:shadow-card-hover transition-shadow"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-pale text-brand">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-ink">{feature.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-accent">
              How it works
            </p>
            <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">
              Capture, review, decide.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((item) => (
              <div key={item.step} className="relative">
                <span className="text-[13px] font-semibold text-brand-accent">{item.step}</span>
                <h3 className="mt-2 text-[16px] font-semibold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-brand-light bg-brand-pale p-8 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-accent">
              Built on principles
            </p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-ink sm:text-[28px]">
              Honest by design.
            </h2>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              {
                icon: CheckCircle2,
                title: "Never fake functionality",
                description: "Unavailable integrations are labeled; sample scenarios are clearly identified as demo data.",
              },
              {
                icon: Users,
                title: "Human in the loop",
                description: "Proposals can be approved or rejected. The decision is recorded; no external action handler is connected.",
              },
              {
                icon: Zap,
                title: "Deterministic fallbacks",
                description: "Without API keys, CONVIA uses local logic — never hallucinated LLM output.",
              },
            ].map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="rounded-xl border border-brand-light bg-surface p-5">
                  <Icon className="h-5 w-5 text-brand" strokeWidth={1.8} />
                  <h3 className="mt-3 text-[14px] font-semibold text-ink">{p.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
                    {p.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">
            Ready to never drop the thread?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-ink-secondary">
            Create an account, capture an objective, and inspect the records saved to your workspace.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/life"
              className="inline-flex h-11 items-center rounded-[10px] bg-brand px-6 text-[15px] font-medium text-white hover:bg-brand-deep transition-colors"
            >
              Create an account
              <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2} />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-[10px] border border-line bg-surface px-6 text-[15px] font-medium text-ink hover:bg-surface-sunken transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <Logo height={24} showTagline />
          <p className="text-[12.5px] text-ink-muted">
            MIT License · Personal Continuity Engine
          </p>
        </div>
      </footer>
    </div>
  );
}
