import { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Thank You — VANTA GARAGE",
  description: "Your CPM2 vehicle order has been confirmed. Thank you for shopping at VANTA GARAGE.",
  openGraph: {
    title: "Thank You — VANTA GARAGE",
    description: "Your CPM2 vehicle order has been confirmed.",
    type: "website",
    url: "https://cpm2-bay.vercel.app/store/checkout/thank-you",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Thank You — VANTA GARAGE",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Thank You — VANTA GARAGE",
    description: "Your CPM2 vehicle order has been confirmed.",
    images: ["/og-image.svg"],
  },
};

export const dynamic = "force-dynamic";

export default function ThankYouPage() {
  return (
    <StoreShell>
      <PageHeading folio="TY" title="Thank You" backHref="/store/dashboard" />
      <section className="panel rounded-xl border border-border p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            className="w-6 h-6 text-primary"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Order Confirmed
        </h2>
        <p className="text-muted-foreground mb-6">
          Your vehicle purchase is confirmed. Check your orders page for delivery tracking and next steps.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/store/dashboard" className="Button primary">
            Go to Dashboard
          </Link>
          <Link href="/store/orders" className="Button outline">
            View All Orders
          </Link>
        </div>
      </section>
    </StoreShell>
  );
}
