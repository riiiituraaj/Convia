"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * CONVIA brand mark.
 *
 * Renders the official logo asset at `public/logo.png` at its natural
 * proportions (never stretched). If the asset is not present yet, the component
 * degrades gracefully to the CONVIA wordmark so navigation stays usable.
 */
export interface LogoProps {
  /** `light` for placement on the deep-green gradient, `dark` for white surfaces. */
  variant?: "light" | "dark";
  /** Rendered height of the mark in pixels. */
  height?: number;
  /** Appends the "Never lose the thread." tagline. */
  showTagline?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  variant = "dark",
  height = 30,
  showTagline = false,
  className,
}) => {
  const [failed, setFailed] = useState(false);

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo.png"
          alt="CONVIA"
          height={height}
          style={{ height, width: "auto" }}
          className="block shrink-0 object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={cn(
            "font-semibold tracking-[0.2em]",
            variant === "light" ? "text-white" : "text-brand-deep"
          )}
          style={{ fontSize: Math.max(13, height * 0.55), lineHeight: `${height}px` }}
        >
          CONVIA
        </span>
      )}

      {showTagline ? (
        <span
          className={cn(
            "hidden text-[12px] font-medium sm:inline",
            variant === "light" ? "text-white" : "text-ink-muted"
          )}
        >
          Never lose the thread.
        </span>
      ) : null}
    </span>
  );
};

/** Mark-only usage (mobile header, empty states, favicons). */
export const LogoMark: React.FC<{ height?: number; className?: string }> = ({
  height = 28,
  className,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-label="CONVIA"
        className={cn(
          "inline-flex items-center justify-center rounded-md bg-brand-pale font-semibold text-brand-deep",
          className
        )}
        style={{ height, width: height }}
      >
        C
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="CONVIA"
      height={height}
      style={{ height, width: "auto" }}
      className={cn("block object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
};
