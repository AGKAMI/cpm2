"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";

type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
};

type ToastApi = {
  push: (toast: Omit<Toast, "id">) => void;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const TONES: Record<ToastKind, { accent: string; icon: ReactNode }> = {
  success: {
    accent: "text-mint-glow",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  error: {
    accent: "text-red-glow",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.2v.1" strokeLinecap="round" />
      </svg>
    ),
  },
  info: {
    accent: "text-cyan-glow",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5M12 7.8v.1" strokeLinecap="round" />
      </svg>
    ),
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      window.setTimeout(() => remove(id), toast.kind === "error" ? 7000 : 4200);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, detail) => push({ kind: "success", title, detail }),
      error: (title, detail) => push({ kind: "error", title, detail }),
      info: (title, detail) => push({ kind: "info", title, detail }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="panel animate-pop pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3"
          >
            <span className={`mt-0.5 ${TONES[toast.kind].accent}`}>{TONES[toast.kind].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-ash-100">
                {toast.title}
              </p>
              {toast.detail ? (
                <p className="mt-1 break-words text-xs leading-snug text-ash-400">{toast.detail}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              aria-label="Dismiss notification"
              className="text-ash-600 transition hover:text-ash-200"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      push: () => undefined,
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
    };
  }
  return context;
}
