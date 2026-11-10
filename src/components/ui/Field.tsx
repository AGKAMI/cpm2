"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { formatNumber } from "@/lib/constants";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  meter?: { value: number; max: number; tone?: "brass" | "racing" | "blueprint" };
};

export function Field({ label, hint, error, children, htmlFor, meter }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-base font-bold text-foreground">
        {label}
        {hint ? <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span> : null}
      </label>
      {children}
      {meter ? <Meter value={meter.value} max={meter.max} tone={meter.tone ?? "racing"} /> : null}
      {error ? (
        <p className="flex items-start gap-1.5 text-xs leading-snug text-destructive">
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

function Meter({ value, max, tone }: { value: number; max: number; tone: "brass" | "racing" | "blueprint" }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const near = ratio >= 0.8;
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-background">
      <div
        className={`h-full transition-[width] duration-500 ${near ? "bg-destructive" : tone}`}
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
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground ${mono ? "font-mono" : ""} ${invalid ? "border-destructive" : ""} ${className}`}
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
  const shown = (v: number) => (v === 0 ? "" : formatNumber(v));
  const [draft, setDraft] = useState(() => shown(value));
  const [focused, setFocused] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (!focused) setDraft(shown(value));
  }

  return (
    <div className="relative">
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={draft}
        placeholder={placeholder ?? "0"}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setDraft(shown(value));
        }}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
          setDraft(raw);
          const parsed = raw === "" ? 0 : Number.parseInt(raw, 10);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground pr-16 ${invalid ? "border-destructive" : ""}`}
      />
      {max !== undefined && value >= max ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium uppercase text-destructive">
          MAX
        </span>
      ) : suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium uppercase text-muted-foreground">
          {suffix}
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
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground resize-none leading-relaxed"
    />
  );
}
