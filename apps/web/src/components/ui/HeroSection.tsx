"use client";

import React from "react";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { SearchCommand } from "./SearchCommand";

export interface HeroSectionProps {
  eyebrow?: string;
  /** e.g. "Good evening" */
  greeting: string;
  /** Dynamic user name from the API (`/auth/me`). */
  name: string;
  description: string;
  /** Contextual message rendered on the right of the hero. */
  quote: { text: string; source?: string };
  onOpenCommand: () => void;
  /** Optional status chip content. */
  status?: React.ReactNode;
  actions?: React.ReactNode;
  /** Extra metadata line under the profile chip, e.g. autonomy level. */
  meta?: React.ReactNode;
  className?: string;
}

/**
 * CONVIA dashboard hero: deep-green brand gradient, white typography,
 * command search, profile controls and a contextual quote.
 */
export const HeroSection: React.FC<HeroSectionProps> = ({
  eyebrow = "Your life, in continuity",
  greeting,
  name,
  description,
  quote,
  onOpenCommand,
  status,
  actions,
  meta,
  className,
}) => (
  <section
    aria-label="Dashboard overview"
    className={cn(
      "convia-hero-surface rounded-2xl border border-[rgba(255,255,255,0.07)] p-6 shadow-card sm:p-8 lg:p-9",
      className
    )}
  >
    {/* Command bar + identity */}
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <SearchCommand
        variant="on-brand"
        onClick={onOpenCommand}
        className="w-full lg:max-w-xl"
        placeholder="Search commitments, missions, or anything..."
      />

      <div className="flex flex-wrap items-center gap-3">
        {status}
        <div className="flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.08] py-1 pl-1 pr-3 backdrop-blur-sm">
          <Avatar name={name} size="sm" className="bg-white/90 text-brand-deep" />
          <div className="leading-tight">
            <div className="text-[12px] font-semibold text-white">{name}</div>
            {meta ? <div className="text-[12px] text-white">{meta}</div> : null}
          </div>
        </div>
      </div>
    </div>

    <div className="convia-hairline my-6 h-px" />

    {/* Greeting + contextual quote */}
    <div className="grid gap-7 lg:grid-cols-[1.7fr_1fr] lg:items-end">
      <div>
        <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-accent animate-pulse-soft" />
          {eyebrow}
        </p>

        <h1 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[42px] lg:text-[48px]">
          {greeting},
          <br />
          <span className="text-white">{name}.</span>
        </h1>

        <p className="mt-3.5 max-w-xl text-[14px] leading-relaxed text-white sm:text-[15px]">
          {description}
        </p>

        {actions ? <div className="mt-6 flex flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>

      <figure className="convia-on-brand-control rounded-xl p-4 sm:p-5">
        <Quote className="h-4 w-4 text-brand-light/80" strokeWidth={1.9} />
        <blockquote className="mt-2.5 text-[14px] leading-relaxed text-white">
          {quote.text}
        </blockquote>
        {quote.source ? (
          <figcaption className="mt-3 text-[12px] font-medium uppercase tracking-[0.12em] text-white">
            {quote.source}
          </figcaption>
        ) : null}
      </figure>
    </div>
  </section>
);
