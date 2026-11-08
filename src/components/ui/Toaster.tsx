"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  action?: ToastAction;
};

type ToastApi = {
  push: (toast: Omit<Toast, "id">) => void;
  success: (title: string, detail?: string, action?: ToastAction) => void;
  error: (title: string, detail?: string, action?: ToastAction) => void;
  info: (title: string, detail?: string, action?: ToastAction) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const TONES: Record<ToastKind, { accent: string; bar: string; icon: ReactNode }> = {
  success: {
    accent: "text-emerald-500",
    bar: "border-emerald-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  error: {
    accent: "text-destructive",
    bar: "border-destructive",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.2v.1" strokeLinecap="round" />
      </svg>
    ),
  },
  info: {
    accent: "text-primary",
    bar: "border-primary",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
      success: (title, detail, action) => push({ kind: "success", title, detail, action }),
      error: (title, detail, action) => push({ kind: "error", title, detail, action }),
      info: (title, detail, action) => push({ kind: "info", title, detail, action }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,380px)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`flex items-start gap-3 rounded-md border-l-[3px] bg-background p-4 shadow-lg ${TONES[toast.kind].bar}`}
          >
            <span className={`mt-0.5 shrink-0 ${TONES[toast.kind].accent}`}>{TONES[toast.kind].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{toast.title}</p>
              {toast.detail ? (
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{toast.detail}</p>
              ) : null}
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    remove(toast.id);
                  }}
                  className="mt-2 text-xs font-semibold underline-offset-4 hover:underline text-primary"
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              aria-label="Dismiss notification"
              className="mr-2 -mt-2 flex h-8 w-8 shrink-0 items-center rounded-md text-muted-foreground hover:border-primary hover:text-primary-foreground transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
