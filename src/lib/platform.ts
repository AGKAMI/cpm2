/**
 * Platform detection — what the app can honestly say about where a session is
 * running, for the "logged in on X" badge.
 *
 * - Inside the Telegram mini app the SDK hands us the exact platform:
 *   android / ios / tdesktop / weba (web) / macos / unknown.
 * - When no browser matches, the DEVICE (Windows / macOS / iOS / Android /
 *   Linux) carries the badge with its own mark; the globe is the last resort.
 * - In a plain browser, userAgent gives the browser (Chrome incl. iOS, Safari,
 *   Firefox, Edge, Opera, Samsung Internet) and the OS (Windows / macOS /
 *   Android / iOS / Linux). Anything unrecognised reports "this browser"
 *   instead of guessing.
 *
 * The client only reads this after mount — SSR must stay hydration-safe.
 */

export type Platform =
  | { kind: "telegram"; label: string; platform?: string; icon: string }
  | { kind: "browser"; label: string; icon: string }
  | { kind: "device"; label: string; icon: string }
  | { kind: "unknown"; label: string; icon?: undefined };

function detectBrowser(): string | null {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (!ua) return null;
  // Order matters — Edge/Opera/Samsung all carry "Chrome" in their UA.
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/Firefox|FxiOS/i.test(ua)) return "Firefox";
  if (/CriOS/i.test(ua)) return "Chrome"; // Chrome on iOS
  if (/Chrome|Chromium/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua)) return "Safari";
  return null;
}

function detectOS(): string | null {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (!ua) return null;
  if (/Windows/i.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Linux/i.test(ua)) return "Linux";
  return null;
}

const TG_PLATFORMS: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  tdesktop: "Telegram Desktop",
  weba: "Telegram Web",
  web: "Telegram Web",
  webz: "Telegram Web",
  macos: "macOS",
  unknown: "Telegram",
};

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return { kind: "unknown", label: "this device" };

  // Telegram mini app: the SDK is present AND the session carries initData.
  // The badge says "Logged in on Telegram" — the sub-platform (Android, iOS,
  // Desktop, Web) stays available on the detection result for future use.
  const tg = window.Telegram;
  if (tg && tg.WebApp?.initData) {
    return { kind: "telegram", label: "Telegram", platform: tg.WebApp.platform ?? "unknown", icon: "/brands/telegram.svg" };
  }

  const browser = detectBrowser();
  if (browser) {
    // The brand files live in public/brands; "Samsung Internet" files as
    // samsung.svg, everything else lowercases cleanly.
    const key = browser === "Samsung Internet" ? "samsung" : browser.toLowerCase();
    return { kind: "browser", label: browser, icon: `/brands/${key}.svg` };
  }

  // Browser unrecognised — fall back to the DEVICE (its own mark), and only
  // if that is unknown too does the badge drop to the neutral globe.
  const os = detectOS();
  if (os) {
    return { kind: "device", label: os, icon: `/brands/${os.toLowerCase()}.svg` };
  }
  return { kind: "unknown", label: "this browser" };
}
