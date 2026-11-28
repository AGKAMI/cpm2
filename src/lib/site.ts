/** Canonical public origin, shared by links in notifications, payment
 * callbacks, metadata and sitemap generation. Keeping it in one place means
 * a deployment can be moved by setting NEXT_PUBLIC_SITE_URL once instead of
 * editing hardcoded strings across the app. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  // Last-resort defaults only: a local dev server, or the historical Vercel
  // domain for an old deployment that has not set NEXT_PUBLIC_SITE_URL yet.
  return process.env.VERCEL ? "https://cpm2-bay.vercel.app" : "http://localhost:3000";
}
