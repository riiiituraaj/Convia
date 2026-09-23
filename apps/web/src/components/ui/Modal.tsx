"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./Button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Optional short label rendered above the title, e.g. "Action passport". */
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg";
  className?: string;
}

const WIDTHS = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" } as const;

/** Accessible dialog used for every CONVIA modal. */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  eyebrow,
  children,
  footer,
  maxWidth = "md",
  className,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-[rgba(11,47,36,0.42)] p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full rounded-t-2xl border border-line bg-surface shadow-pop outline-none animate-scale-in sm:rounded-2xl",
          WIDTHS[maxWidth],
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-subtle px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            {icon ? (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-brand-light bg-brand-pale text-brand">
                {icon}
              </span>
            ) : null}
            <div>
              {eyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-accent">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
              {subtitle ? (
                <p className="mt-0.5 text-[13px] text-ink-secondary">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line-subtle px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};
