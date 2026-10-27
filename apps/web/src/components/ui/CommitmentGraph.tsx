"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/ui";

export interface GraphSatellite {
  id: string;
  label: string;
  detail?: string;
  icon: LucideIcon;
  tone: Tone;
}

export interface CommitmentGraphProps {
  center: { title: string; subtitle?: string; meta?: string };
  satellites: GraphSatellite[];
  className?: string;
}

const WIDTH = 760;
const HEIGHT = 400;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const RX = 272;
const RY = 142;

const TONE_LABELS: Partial<Record<Tone, string>> = {
  success: "No saved risk",
  brand: "Current commitment",
  info: "Dependency",
  danger: "Saved risk label",
  warning: "Review needed",
  neutral: "Related",
};

/**
 * Relationship graph around the current commitment.
 * Thin connectors, rounded nodes, semantic colours, generous whitespace.
 */
export const CommitmentGraph: React.FC<CommitmentGraphProps> = ({
  center,
  satellites,
  className,
}) => {
  const count = Math.max(satellites.length, 1);

  const positions = satellites.map((_, index) => {
    const theta = (index / count) * Math.PI * 2 - Math.PI / 2;
    return { x: CX + RX * Math.cos(theta), y: CY + RY * Math.sin(theta) };
  });

  const legendTones = Array.from(new Set(satellites.map((s) => s.tone)));

  return (
    <div className={cn("space-y-4", className)}>
      <div className="convia-scroll-x overflow-x-auto">
        <div className="relative mx-auto min-w-[660px]" style={{ height: HEIGHT }}>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width="100%"
            height={HEIGHT}
            className="absolute inset-0"
            aria-hidden="true"
          >
            <circle cx={CX} cy={CY} r={96} fill="#25A866" fillOpacity="0.05" />
            <circle
              cx={CX}
              cy={CY}
              r={150}
              fill="none"
              stroke="#E1E9E4"
              strokeWidth="1"
              strokeDasharray="3 6"
            />

            {positions.map((point, index) => {
              const satellite = satellites[index];
              const color = toneClasses(satellite.tone).hex;
              return (
                <path
                  key={satellite.id}
                  d={`M ${CX} ${CY} L ${point.x} ${point.y}`}
                  fill="none"
                  stroke={color}
                  strokeOpacity={satellite.tone === "neutral" ? 0.35 : 0.5}
                  strokeWidth="1.25"
                  strokeDasharray={satellite.tone === "neutral" ? "4 4" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          <div
            className="absolute w-[215px] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${(CX / WIDTH) * 100}%`, top: `${(CY / HEIGHT) * 100}%` }}
          >
            <div className="convia-hero-surface rounded-xl px-4 py-4 text-center shadow-card-hover">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                Current commitment
              </p>
              <p className="mt-1.5 text-[14px] font-semibold leading-snug text-white">
                {center.title}
              </p>
              {center.subtitle ? (
                <p className="mt-1 text-[12px] leading-relaxed text-white">
                  {center.subtitle}
                </p>
              ) : null}
              {center.meta ? (
                <p className="mt-2.5 inline-flex rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white">
                  {center.meta}
                </p>
              ) : null}
            </div>
          </div>

          {satellites.map((satellite, index) => {
            const Icon = satellite.icon;
            const style = toneClasses(satellite.tone);
            const point = positions[index];
            return (
              <div
                key={satellite.id}
                className="absolute w-[152px] -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${(point.x / WIDTH) * 100}%`,
                  top: `${(point.y / HEIGHT) * 100}%`,
                }}
              >
                <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-card transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-card-hover">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                      style.soft,
                      style.text
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-ink">
                      {satellite.label}
                    </p>
                    {satellite.detail ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-secondary">
                        {satellite.detail}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-subtle pt-3.5">
        {legendTones.map((tone) => (
          <span
            key={tone}
            className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-secondary"
          >
            <span className={cn("h-2 w-2 rounded-full", toneClasses(tone).dot)} />
            {TONE_LABELS[tone] ?? "Related"}
          </span>
        ))}
      </div>
    </div>
  );
};
