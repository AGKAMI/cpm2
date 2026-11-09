import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { JetBrains_Mono } from "next/font/google";
import "@/app/globals.css";
import { TelegramBridge } from "@/components/TelegramBridge";
import { ToastProvider } from "@/components/ui/Toaster";
import { DEFAULT_PALETTE, PALETTE_IDS } from "@/lib/themes";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const themeScript = `(function(){try{var d=document.documentElement;var m=localStorage.getItem("cpm2:theme:v2");d.setAttribute("data-theme",m==="paper"?"paper":"night");var p=localStorage.getItem("cpm2:palette:v1");var ids=${JSON.stringify(PALETTE_IDS)};d.setAttribute("data-palette",ids.indexOf(p)>=0?p:"${DEFAULT_PALETTE}");}catch(e){}})();`;

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

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable}`} suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              var d=document.documentElement,b=document.body;
              var waited=0;
              var poll=setInterval(function(){
                var w=window.Telegram?.WebApp;
                if(w){
                  clearInterval(poll);
                  try{
                    w.ready?.();w.expand?.();
                    d.style.touchAction='manipulation';
                    if(b){
                      b.style.touchAction='manipulation';
                    }
                  }catch(e){}
                  return;
                }
                waited+=50;
                if(waited>=30000) clearInterval(poll);
              },50);
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
          {children}
          <TelegramBridge />
        </ToastProvider>
      </body>
    </html>
  );
}