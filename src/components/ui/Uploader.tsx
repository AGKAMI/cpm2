"use client";

import React from "react";

/**
 * VANTA GARAGE file uploader — gold dashed drop block with shine sweep.
 * Replaces the bare "Choose file" input across the store admin, fleet
 * ledger, trade-in picker and checkout payment proof.
 *
 * Clicking the block (or dropping files on it) feeds `onFiles`. The hidden
 * input is still ref-forwarded via `inputRef` so legacy triggers
 * (e.g. "Choose a different screenshot") keep working.
 */
export interface UploaderProps {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Half-height block for dense admin form rows */
  compact?: boolean;
  /** Chosen file name shown inside the block (optional) */
  fileName?: string | null;
  /** Busy state (e.g. converting) — shows a pulsing status line */
  busy?: string | null;
  /** Validation error — red glowing border */
  error?: boolean;
  onFiles: (files: FileList | null) => void;
  className?: string;
  label?: string;
  id?: string;
}

const UploadIcon = ({ size }: { size: number }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ height: size, width: size }}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 1C9.73478 1 9.48043 1.10536 9.29289 1.29289L3.29289 7.29289C3.10536 7.48043 3 7.73478 3 8V20C3 21.6569 4.34315 23 6 23H7C7.55228 23 8 22.5523 8 22C8 21.4477 7.55228 21 7 21H6C5.44772 21 5 20.5523 5 20V9H10C10.5523 9 11 8.55228 11 8V3H18C18.5523 3 19 3.44772 19 4V9C19 9.55228 19.4477 10 20 10C20.5523 10 21 9.55228 21 9V4C21 2.34315 19.6569 1 18 1H10ZM9 7H6.41421L9 4.41421V7ZM14 15.5C14 14.1193 15.1193 13 16.5 13C17.8807 13 19 14.1193 19 15.5V16V17H20C21.1046 17 22 17.8954 22 19C22 20.1046 21.1046 21 20 21H13C11.8954 21 11 20.1046 11 19C11 17.8954 11.8954 17 13 17H14V16V15.5ZM16.5 11C14.142 11 12.2076 12.8136 12.0156 15.122C10.2825 15.5606 9 17.1305 9 19C9 21.2091 10.7909 23 13 23H20C22.2091 23 24 21.2091 24 19C24 17.1305 22.7175 15.5606 20.9844 15.122C20.7924 12.8136 18.858 11 16.5 11Z"
    />
  </svg>
);

export function Uploader({
  inputRef,
  accept,
  multiple,
  disabled,
  compact = false,
  fileName,
  busy,
  error = false,
  onFiles,
  className = "",
  label = "Click to upload image",
  id,
}: UploaderProps) {
  const [dragOver, setDragOver] = React.useState(false);
  const hasFile = Boolean(fileName);
  const isBusy = Boolean(busy);

  return (
    <label
      htmlFor={id}
      className={`relative flex flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed text-center transition-colors duration-150 ${
        compact ? "min-h-[104px] px-4 py-4" : "min-h-[200px] px-6 py-8"
      } ${
        disabled
          ? "cursor-not-allowed opacity-50 border-border bg-secondary"
          : error
            ? "cursor-pointer border-destructive border-glow-red bg-[#17100e]"
            : dragOver
              ? "cursor-pointer border-[#d4af4f] bg-[#1a170e]"
              : "cursor-pointer border-[#8f6f26]/45 bg-[#131315] hover:border-[#d4af4f] hover:bg-[#171410]"
      } ${className}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled) onFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => onFiles(e.target.files)}
      />
      {/* Diagonal gold glare sweep */}
      {!disabled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          <span
            className="shine-sweep absolute inset-0"
            style={{
              background:
                "linear-gradient(105deg, transparent 30%, rgba(246,227,160,0.14) 50%, transparent 70%)",
            }}
          />
        </span>
      )}
      <span
        className={`relative flex items-center justify-center ${hasFile ? "text-[#74c69d]" : "text-[#d4af4f]"}`}
      >
        {hasFile ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ height: compact ? 26 : 44, width: compact ? 26 : 44 }} aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <UploadIcon size={compact ? 34 : 64} />
        )}
      </span>
      <span className="relative flex flex-col items-center gap-0.5">
        {isBusy ? (
          <span className="text-[11px] font-bold text-[#d4af4f] animate-pulse">
            {busy}
          </span>
        ) : hasFile ? (
          <>
            <span className="text-[11px] font-bold text-foreground max-w-[220px] truncate">
              {fileName}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#d4af4f]/70">
              Click to replace
            </span>
          </>
        ) : (
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#d4af4f]/85">
            {label}
          </span>
        )}
      </span>
    </label>
  );
}
