"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { formatNumber } from "@/lib/constants";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  meter?: { value: number; max: number; tone?: "amber" | "mint" | "cyan" };
};

export function Field({ label, hint, error, children, htmlFor, meter }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="label-caps flex items-center justify-between gap-3">
        <span>{label}</span>
        {hint ? <span className="font-mono tracking-normal text-ash-600 normal-case">{hint}</span> : null}
      </label>
      {children}
      {meter ? <Meter value={meter.value} max={meter.max} tone={meter.tone ?? "amber"} /> : null}
      {error ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-red-glow">
          <svg viewBox="0 0 24 24" className="mt-px h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.2v.1" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Meter({ value, max, tone }: { value: number; max: number; tone: "amber" | "mint" | "cyan" }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const colors: Record<string, string> = {
    amber: "bg-amber-glow",
    mint: "bg-mint-glow",
    cyan: "bg-cyan-glow",
  };
  const near = ratio >= 0.8;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className={`h-full rounded-full transition-all duration-500 ${near ? "bg-red-glow" : colors[tone]}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  mono?: boolean;
};

export function TextInput({ invalid, mono, className = "", ...props }: TextInputProps) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-lg border bg-carbon-950/60 px-3 text-sm text-ash-100 placeholder:text-ash-600 transition-colors focus:border-amber-glow/60 focus:bg-carbon-950/80 focus:outline-none ${
        invalid ? "border-red-glow/60" : "border-white/10"
      } ${mono ? "font-mono tracking-wide" : ""} ${className}`}
    />
  );
}

type NumericInputProps = {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  invalid?: boolean;
  max?: number;
  suffix?: string;
  placeholder?: string;
};

export function NumericInput({
  id,
  value,
  onChange,
  invalid,
  max,
  suffix,
  placeholder,
}: NumericInputProps) {
  const [draft, setDraft] = useState(() => formatNumber(value));
  const [focused, setFocused] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (!focused) setDraft(formatNumber(value));
  }

  return (
    <div className="relative">
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={draft}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setDraft(formatNumber(value));
        }}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d]/g, "");
          setDraft(raw);
          const parsed = raw === "" ? 0 : Number.parseInt(raw, 10);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className={`num h-10 w-full rounded-lg border bg-carbon-950/60 px-3 pr-12 text-sm text-ash-100 placeholder:text-ash-600 transition-colors focus:border-amber-glow/60 focus:bg-carbon-950/80 focus:outline-none ${
          invalid ? "border-red-glow/60" : "border-white/10"
        }`}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-widest text-ash-600">
          {suffix}
        </span>
      ) : null}
      {max !== undefined && value >= max ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-widest text-red-glow">
          MAX
        </span>
      ) : null}
    </div>
  );
}

export function TextArea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <textarea
      id={fieldId}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full resize-none rounded-lg border border-white/10 bg-carbon-950/60 px-3 py-2.5 text-sm text-ash-100 placeholder:text-ash-600 transition-colors focus:border-amber-glow/60 focus:bg-carbon-950/80 focus:outline-none"
    />
  );
}
