import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { ToastProvider } from "@/components/ui/Toaster";
import { DEFAULT_PALETTE, PALETTE_IDS } from "@/lib/themes";

// Theme is user-selectable everywhere now (profile → Appearance). The script
// applies the saved theme before first paint; with nothing saved it falls
// back to the house VANTA identity (gold metallic, black, dark steel).
const themeScript = `(function(){try{var d=document.documentElement;var m=localStorage.getItem("cpm2:theme:v2:store");if(m===null)m=localStorage.getItem("cpm2:theme:v2");d.setAttribute("data-theme",m==="paper"?"paper":"night");var p=localStorage.getItem("cpm2:palette:v1:store");if(p===null)p=localStorage.getItem("cpm2:palette:v1");var ids=${JSON.stringify(PALETTE_IDS)};d.setAttribute("data-palette",ids.indexOf(p)>=0?p:"${DEFAULT_PALETTE}");}catch(e){}})();`;

export const metadata: Metadata = {
  title: "VANTA GARAGE - CPM2 vehicles for sale",
  description: "Premium CPM2 vehicle storefront. Ready-to-purchase cars, limited editions, One of One builds.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f3f5" },
    { media: "(prefers-color-scheme: dark)", color: "#090b0f" },
  ],
};

// NESTED layout — must NOT render <html>/<body>: the root layout already
// owns the document (and wraps every route in the fleet AppShell). Rendering a
// second document here left the streamed Suspense boundary stranded at body
// level and duplicated the whole storefront after hydration.
//
// The Telegram Web App SDK (beforeInteractive in the root layout), the
// ready()/expand() call and the header-colour adapter (TelegramBridge) are
// all loaded in the ROOT layout and run on every route — /store included.
// Mounting them here as well loaded the SDK a SECOND time (TelegramInit
// appends its own script tag), called ready()/expand() twice, and fought
// over the WebApp header colour (TelegramInit's hard-coded #0a0a0a vs the
// theme-derived paint) — so this layout intentionally renders neither.
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: themeScript }}
        suppressHydrationWarning
      />
      {/* Telegram SDK + TelegramBridge live in the root layout only (see the
          comment above) — mounting them here duplicated both. */}
      <ToastProvider>
        {children}
      </ToastProvider>
    </>
  );
}