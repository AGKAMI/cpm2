"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ThemeGallery } from "@/components/ThemeGallery";
import { useTheme } from "@/hooks/useTheme";

export function ThemeMenu() {
  const [open, setOpen] = useState(false);
  const { mode } = useTheme();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Change appearance"
        aria-label="Change appearance"
        aria-haspopup="dialog"
        className="square-btn relative h-9 w-9"
      >
        {mode === "night" ? (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" strokeLinejoin="round" />
          </svg>
        )}
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-racing" aria-hidden="true" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Appearance"
        subtitle="Neutral glass · single and double-tone accents"
        width="max-w-xl"
      >
        <ThemeGallery />
      </Modal>
    </>
  );
}
