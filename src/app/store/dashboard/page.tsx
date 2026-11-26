/** VANTA GARAGE — customer dashboard.
 * /store/dashboard
 * Customer-gated: active orders + recent purchase history.
 */

import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Customer Dashboard - VANTA GARAGE",
  description: "View your active orders and recent purchases at VANTA GARAGE.",
  openGraph: {
    title: "Customer Dashboard - VANTA GARAGE",
    description: "View your active orders and recent purchases at VANTA GARAGE.",
    type: "website",
    url: "/store/dashboard",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Customer Dashboard - VANTA GARAGE" }],
  },
  twitter: { card: "summary_large_image", title: "Customer Dashboard - VANTA GARAGE", description: "View your active orders and recent purchases at VANTA GARAGE.", images: ["/og-image.svg"] },
};

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import DashboardClient from "./page.client";
import { DashboardSkeleton } from "@/components/skeleton";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient />
    </Suspense>
  );
}
