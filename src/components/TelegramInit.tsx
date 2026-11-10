"use client";

import { useEffect } from "react";

/**
 * Sets touch-action: manipulation on the document root on the client only.
 * The previous inline <script dangerouslySetInnerHTML> in store/layout.tsx
 * applied these styles during SSR, causing a React hydration mismatch
 * (React finds inline styles on <html>/<body> it did not set).
 *
 * TelegramBridge already handles ready()/expand() polling — this component
 * only owns the touch-action style, which must be set after hydration.
 */
export function TelegramInit() {
  useEffect(() => {
    document.documentElement.style.touchAction = "manipulation";
    if (document.body) {
      document.body.style.touchAction = "manipulation";
    }
  }, []);

  return null;
}
