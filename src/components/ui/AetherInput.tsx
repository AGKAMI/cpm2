"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

type AetherInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  error?: string;
  mono?: boolean;
};

export function AetherInput({
  label,
  hint,
  prefix,
  suffix,
  error,
  mono,
  className = "",
  ...props
}: AetherInputProps) {
  const generatedId = `aether-input-${Math.random().toString(36).slice(2)}`;

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label
          htmlFor={props.id ?? generatedId}
          className="label-caps block mb-0.5"
        >
          {label}
          {hint ? <span className="ml-2 num text-[10px] tracking-normal normal-case text-aether-text-faint">{hint}</span> : null}
        </label>
      ) : null}

      <div className="relative">
        {prefix ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-aether-text-soft text-[12px] pointer-events-none">
            {prefix}
          </span>
        ) : null}

        <input
          {...props}
          id={props.id ?? generatedId}
          className={`aether-input ${mono ? "num" : ""} ${error ? "border-aether-accent/50 focus:border-aether-accent" : ""} pl-10 pr-10 ${className}`}
        />

        {suffix ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-aether-text-soft text-[12px] pointer-events-none">
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-aether-accent">
          <svg viewBox="0 0 24 24" className="mt-px h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.2v.1" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  );
}
