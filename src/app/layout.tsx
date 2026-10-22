import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { FleetProvider } from "@/components/FleetProvider";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/ui/Toaster";

const body = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CPM2 // FLEET LEDGER",
  description:
    "Track Car Parking Multiplayer 2 accounts — balances, coins, cars and purchased car slots.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a0b0a" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <ToastProvider>
          <FleetProvider>
            <AppShell>{children}</AppShell>
          </FleetProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
