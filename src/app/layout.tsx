import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { FleetProvider } from "@/components/FleetProvider";
import { AppShell } from "@/components/AppShell";
import { TelegramBridge } from "@/components/TelegramBridge";
import { ToastProvider } from "@/components/ui/Toaster";
import { FLEET_DEFAULT_PALETTE, PALETTE_IDS } from "@/lib/themes";

const mono = { variable: "" };

// Nothing saved → Fleet Ledger opens in Neon 2 TONE. /store re-applies the
// house VANTA identity with its own later script (src/app/store/layout.tsx).
const themeScript = `(function(){try{var d=document.documentElement;var m=localStorage.getItem("cpm2:theme:v2");d.setAttribute("data-theme",m==="paper"?"paper":"night");var p=localStorage.getItem("cpm2:palette:v1");var ids=${JSON.stringify(PALETTE_IDS)};d.setAttribute("data-palette",ids.indexOf(p)>=0?p:"${FLEET_DEFAULT_PALETTE}");}catch(e){}})();`;

export const metadata: Metadata = {
  title: "CPM // FLEET LEDGER",
  description:
    "Track Car Parking Multiplayer accounts - CPM1 and CPM2 - balances, coins, cars and purchased car slots.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f3f5" },
    { media: "(prefers-color-scheme: dark)", color: "#090b0f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: the themeScript above writes data-theme and
  // data-palette onto <html> before React hydrates, so the client element
  // deliberately carries attributes the server HTML does not have. Without it
  // React reports a mismatch on every load and may revert them, which shows up
  // as a theme flash. Scoped to this one element — it suppresses the attribute
  // diff here and nothing else.
  return (
    <html
      lang="en"
      className={`${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        {/* Lock scroll/zoom + call Telegram WebApp ready()/expand() ONLY if we're in a WebApp context.
           When opened from the bot profile "OPEN" button (outside the chat),
           Telegram may not inject window.Telegram.WebApp at all. If we lock
           overflow:hidden without ever calling ready()/expand(), the page is
           stuck as raw HTML. Only lock when WebApp is confirmed. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              var w=window.Telegram?.WebApp;
              if(w){
                try{
                  w.ready?.();w.expand?.();
                  document.documentElement.style.touchAction='manipulation';
                }catch(e){}
              }
            })()`,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Capture Telegram's initData from the URL hash BEFORE the SDK loads.
            In a desktop browser the SDK replaces window.Telegram with an object
            whose initData is empty, so the auth header would be lost — stash it
            (global + sessionStorage) and read it back via clientInitData(). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=/(?:^|[?&#])tgWebAppData=([^&]+)/.exec(location.hash);if(m){var r=decodeURIComponent(m[1]);if(r){window.__CPM2_INITDATA=r;try{sessionStorage.setItem("cpm2_tg_initdata",r)}catch(e){}}}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`min-h-screen antialiased bg-background ${mono.variable}`}>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <ToastProvider>
          <FleetProvider>
            <AppShell>{children}</AppShell>
          </FleetProvider>
          {/* Silent adapter: only acts when the console runs inside Telegram. */}
          <TelegramBridge />
        </ToastProvider>
      </body>
    </html>
  );
}
