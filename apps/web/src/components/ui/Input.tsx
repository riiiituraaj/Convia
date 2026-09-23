"use client";

import React from "react";
import { cn } from "@/lib/utils";

const FIELD_BASE =
  "w-full rounded-[10px] border bg-surface text-sm text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-150 ease-out focus:outline-none focus:border-brand-accent focus:shadow-focus disabled:cursor-not-allowed disabled:bg-surface-sunken";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        FIELD_BASE,
        "h-10 px-3",
        invalid ? "border-danger" : "border-line-strong",
        className
      )}
      {...rest}
    />
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid = false, rows = 3, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        FIELD_BASE,
        "resize-none px-3 py-2.5 leading-relaxed",
        invalid ? "border-danger" : "border-line-strong",
        className
      )}
      {...rest}
    />
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(FIELD_BASE, "h-10 border-line-strong px-3 pr-8", className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export interface FieldProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, hint, htmlFor, className, children }) => (
  <div className={cn("space-y-1.5", className)}>
    <label
      htmlFor={htmlFor}
      className="block text-[12px] font-medium uppercase tracking-[0.08em] text-ink-secondary"
    >
      {label}
    </label>
    {children}
    {hint ? <p className="text-[12px] text-ink-muted">{hint}</p> : null}
  </div>
);
