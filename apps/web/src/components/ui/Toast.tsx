"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "danger" | "warning" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

/** `useToast()` is available inside the CONVIA app shell. */
export const useToast = (): ToastContextValue => useContext(ToastContext);

const TONE_STYLES: Record<ToastTone, { icon: React.ElementType; accent: string; text: string }> = {
  success: { icon: CheckCircle2, accent: "bg-success", text: "text-success" },
  danger: { icon: XCircle, accent: "bg-danger", text: "text-danger" },
  warning: { icon: AlertTriangle, accent: "bg-warning", text: "text-warning" },
  info: { icon: Info, accent: "bg-info", text: "text-info" },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ title, description, tone = "success" }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((current) => [...current.slice(-2), { id, title, description, tone }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-[76px] z-[60] flex flex-col gap-2.5 sm:inset-x-auto sm:right-6 sm:w-[368px]"
        aria-live="polite"
        role="status"
      >
        {items.map((item) => {
          const tone = TONE_STYLES[item.tone];
          const Icon = tone.icon;
          return (
            <div
              key={item.id}
              className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-line bg-surface p-3.5 pr-2.5 shadow-card-hover animate-fade-in-up"
            >
              <span className={cn("absolute left-0 h-full w-1", tone.accent)} aria-hidden="true" />
              <Icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", tone.text)} strokeWidth={1.9} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
