/** VANTA GARAGE — legal documents.
 * /legal/[doc] — Terms, Privacy, Refund, Delivery, Payment, Cancellation, Appointment, Dispute
 * Static policy pages with versioning. Content: src/lib/legal-docs.tsx
 * (shared with /store/profile/legal/[doc] so the two can't drift apart).
 */

import type { Metadata } from "next";
import { LEGAL_DOCS, LegalDocView } from "@/lib/legal-docs";

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc: docSlug } = await params;
  const doc = LEGAL_DOCS[docSlug];
  return {
    title: doc ? `${doc.title} — VANTA GARAGE` : "Legal — VANTA GARAGE",
  };
}

// params is a Promise in this Next.js version — sync access yields undefined
// and every policy rendered "Document Not Found".
export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc: docSlug } = await params;
  return <LegalDocView doc={LEGAL_DOCS[docSlug]} backHref="/store" backLabel="Back to store" />;
}
