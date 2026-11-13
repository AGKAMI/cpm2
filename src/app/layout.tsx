import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { FleetProvider } from "@/components/FleetProvider";
import { AppShell } from "@/components/AppShell";
import { TelegramBridge } from "@/components/TelegramBridge";
import { ToastProvider } from "@/components/ui/Toaster";
import { DEFAULT_PALETTE, PALETTE_IDS } from "@/lib/themes";

const mono = { variable: "" };

const themeScript = `(function(){try{var d=document.documentElement;var m=localStorage.getItem("cpm2:theme:v2");d.setAttribute("data-theme",m==="paper"?"paper":"night");var p=localStorage.getItem("cpm2:palette:v1");var ids=${JSON.stringify(PALETTE_IDS)};d.setAttribute("data-palette",ids.indexOf(p)>=0?p:"${DEFAULT_PALETTE}");}catch(e){}})();`;

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
