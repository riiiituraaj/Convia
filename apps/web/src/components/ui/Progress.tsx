"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { clampPercent, toneClasses, type Tone } from "@/lib/ui";

export interface ProgressRingProps {
  /** 0 - 100 */
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  className?: string;
  children?: React.ReactNode;
}

/** Elegant circular progress indicator used by the Continuity Score. */
export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  size = 132,
  stroke = 10,
  tone = "success",
  className,
  children,
}) => {
  const safeValue = clampPercent(value);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safeValue / 100) * circumference;
  const color = toneClasses(tone).hex;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${safeValue} percent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EDF2EF"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
};

export interface ProgressBarProps {
  /** 0 - 100 */
  value: number;
  tone?: Tone;
  size?: "sm" | "md";
  className?: string;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  tone = "success",
  size = "sm",
  className,
  label,
}) => {
  const safeValue = clampPercent(value);

  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-surface-sunken", className)}
      style={{ height: size === "sm" ? 6 : 8 }}
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${safeValue}%`, backgroundColor: toneClasses(tone).hex }}
      />
    </div>
  );
};
