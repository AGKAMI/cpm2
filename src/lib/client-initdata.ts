/**
 * Browser-only Telegram initData reader.
 *
 * Inside Telegram the raw initData lives on window.Telegram.WebApp.initData.
 * In a desktop browser the official SDK (telegram-web-app.js) still loads and
 * REPLACES window.Telegram with its own object, whose initData is an empty
 * string — so every API call sent from a plain browser loses the auth header.
 *
 * Two rules fix that:
 *   1. Capture the initData Telegram puts in the URL hash (#tgWebAppData=...)
 *      into a module-global + sessionStorage BEFORE anything can clear it.
 *   2. clientInitData() prefers the captured value, then sessionStorage, and
 *      only then falls back to window.Telegram.WebApp (the live mini app).
 *
 * Order matters: the capture script in layout.tsx <head> runs before the SDK.
 */

const INIT_DATA_KEY = "cpm2_tg_initdata";

/** Pull tgWebAppData out of the URL hash (if present) and stash it. */
export function captureInitDataFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const match = /(?:^|[?&#])tgWebAppData=([^&]+)/.exec(window.location.hash);
    if (!match) return;
    const raw = decodeURIComponent(match[1]);
    if (!raw) return;
    (window as unknown as { __CPM2_INITDATA?: string }).__CPM2_INITDATA = raw;
    try {
      window.sessionStorage.setItem(INIT_DATA_KEY, raw);
    } catch {
      /* private mode — the global above is enough for this page */
    }
  } catch {
    /* malformed hash — ignore */
  }
}

/** The raw initData for this session: captured > sessionStorage > live SDK. */
export function clientInitData(): string {
  if (typeof window === "undefined") return "";
  const glob = (window as unknown as { __CPM2_INITDATA?: string }).__CPM2_INITDATA;
  if (typeof glob === "string" && glob) return glob;
  try {
    const stored = window.sessionStorage.getItem(INIT_DATA_KEY);
    if (stored) return stored;
  } catch {
    /* private mode — fall through */
  }
  const webApp = window.Telegram?.WebApp;
  return typeof webApp?.initData === "string" ? webApp.initData : "";
}