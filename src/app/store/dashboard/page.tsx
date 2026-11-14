/** VANTA GARAGE — customer dashboard.
 * /store/dashboard
 * Customer-gated: active orders + recent purchase history.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer Dashboard - VANTA GARAGE",
  description: "View your active orders and recent purchases at VANTA GARAGE.",
  openGraph: {
    title: "Customer Dashboard - VANTA GARAGE",
    description: "View your active orders and recent purchases at VANTA GARAGE.",
    type: "website",
    url: "https://cpm2-bay.vercel.app/store/dashboard",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Customer Dashboard - VANTA GARAGE" }],
  },
  twitter: { card: "summary_large_image", title: "Customer Dashboard - VANTA GARAGE", description: "View your active orders and recent purchases at VANTA GARAGE.", images: ["/og-image.svg"] },
};

export const dynamic = "force-dynamic";

import DashboardClient from "./page.client";

export default function DashboardPage() {
  return <DashboardClient />;
}
