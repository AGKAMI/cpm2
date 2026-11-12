import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { JetBrains_Mono } from "next/font/google";
import "@/app/globals.css";
import { TelegramBridge } from "@/components/TelegramBridge";
import { TelegramInit } from "@/components/TelegramInit";
import { ToastProvider } from "@/components/ui/Toaster";
import { VantaThemeLock } from "@/components/VantaThemeLock";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// VANTA Garage has its own fixed identity — gold metallic, black, dark steel.
// Fleet Ledger's saved theme must never bleed into store pages, so the
// palette attribute is forced to "vanta" (matches no palette block, so the
// base gold/black tokens apply) before first paint.
const themeScript = `(function(){try{var d=document.documentElement;d.setAttribute("data-theme","night");d.setAttribute("data-palette","vanta");}catch(e){}})();`;

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
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
      </head>
      <body className={`min-h-screen antialiased bg-background ${mono.variable}`}>
        <VantaThemeLock />
        <TelegramInit />
        <ToastProvider>
          {children}
          <TelegramBridge />
        </ToastProvider>
      </body>
    </html>
  );
}