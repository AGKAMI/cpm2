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

/** Telegram appends unsigned tgWebApp* params (Version/Platform/ThemeParams/
 * BotInline) AFTER the initData in the URL hash. If they ride along into the
 * data-check-string the HMAC no longer matches and EVERY authenticated store
 * call fails signature verification (Stars / bulk checkout). Strip them. */
function stripTrailingWebAppParams(raw: string): string {
  const boundary = raw.search(/&tgWebApp[A-Za-z]+=/);
  return boundary >= 0 ? raw.slice(0, boundary) : raw;
}

/** Pull tgWebAppData out of the URL hash (if present) and stash it. */
export function captureInitDataFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    // Telegram puts a raw query string after `tgWebAppData=` — its fields are
    // separated by literal `&`, so `[^&]+` used to stop at the first one and
    // throw away user/auth_date/hash, breaking every hash-URL login. Take
    // everything from the marker to the end of the hash instead.
    const marker = /[?&#]tgWebAppData=/.exec(window.location.hash);
    if (!marker) return;
    const raw = window.location.hash.slice(marker.index + marker[0].length);
    if (!raw) return;
    // Telegram percent-encodes the WHOLE initData as the tgWebAppData value
    // (auth_date%3D…%26user%3D…%26hash%3D…). Decode ONCE so URLSearchParams
    // sees real fields incl. `hash`; without this every real-client call fails
    // signature verification. (Decoding twice is what would split the user JSON.)
    const sliced = stripTrailingWebAppParams(raw);
    if (!sliced) return;
    const initData = decodeURIComponent(sliced);
    if (!initData) return;
    (window as unknown as { __CPM2_INITDATA?: string }).__CPM2_INITDATA = initData;
    try {
      window.sessionStorage.setItem(INIT_DATA_KEY, initData);
    } catch {
      /* private mode — the global above is enough for this page */
    }
  } catch {
    /* malformed hash — ignore */
  }
}

/** Recover values stored by the old (undecoded) capture: a decoded initData
 *  always contains a literal `hash=`; an encoded one only `hash%3D`. */
function normalizeInitData(v: string): string {
  if (/hash=/.test(v)) return v;
  if (/hash%3D/i.test(v)) {
    try { return decodeURIComponent(v); } catch { return v; }
  }
  return v;
}

/** The raw initData for this session: captured > sessionStorage > live SDK. */
export function clientInitData(): string {
  if (typeof window === "undefined") return "";
  const glob = (window as unknown as { __CPM2_INITDATA?: string }).__CPM2_INITDATA;
  if (typeof glob === "string" && glob) return stripTrailingWebAppParams(normalizeInitData(glob));
  try {
    const stored = window.sessionStorage.getItem(INIT_DATA_KEY);
    if (stored) return stripTrailingWebAppParams(normalizeInitData(stored));
  } catch {
    /* private mode — fall through */
  }
  const webApp = window.Telegram?.WebApp;
  return typeof webApp?.initData === "string" ? stripTrailingWebAppParams(normalizeInitData(webApp.initData)) : "";
}