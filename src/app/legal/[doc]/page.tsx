/** VANTA GARAGE — legal documents.
 * /legal/[doc] — Terms, Privacy, Refund, Delivery, Payment, Cancellation, Appointment, Dispute
 * Static policy pages with versioning.
 */

import { Metadata } from "next";
import { getStoreDb } from "@/lib/store-db.ts";

const LEGAL_DOCS: Record<string, { title: string; version: string }> = {
  terms: { title: "Terms & Conditions", version: "1.0" },
  privacy: { title: "Privacy Policy", version: "1.0" },
  refund: { title: "Refund Policy", version: "1.0" },
  delivery: { title: "Delivery Policy", version: "1.0" },
  payment: { title: "Payment Policy", version: "1.0" },
  cancellation: { title: "Cancellation Policy", version: "1.0" },
  appointment: { title: "Appointment Policy", version: "1.0" },
  dispute: { title: "Dispute Policy", version: "1.0" },
};

export async function generateMetadata({ params }: { params: { doc: string } }): Promise<Metadata> {
  const doc = LEGAL_DOCS[params.doc];
  return {
    title: doc ? `${doc.title} — VANTA GARAGE` : "Legal — VANTA GARAGE",
  };
}

export default function LegalPage({ params }: { params: { doc: string } }) {
  const doc = LEGAL_DOCS[params.doc];
  if (!doc) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground">Document Not Found</h1>
        <p className="text-muted-foreground">The requested legal document does not exist.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <nav className="mb-8">
        <a href="/store" className="text-[11px] text-primary hover:underline">
          ← Back to store
        </a>
      </nav>
      <h1 className="text-2xl font-bold text-foreground mb-2">{doc.title}</h1>
      <p className="text-[10px] text-muted-foreground mb-6">
        Version {doc.version} · Last updated {new Date().toLocaleDateString()}
      </p>
      <div className="prose prose-sm max-w-none">
        <p>
          This is the {doc.title} for VANTA GARAGE, the CPM2 vehicle
          marketplace operated via Telegram Mini App and WhatsApp.
        </p>
        <p>
          By using the store, you agree to these terms. If you do not agree,
          please do not place any orders.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          Acceptance
        </h2>
        <p>
          Placing an order through the VANTA GARAGE store constitutes your
          acceptance of this policy in its current version. Version changes are
          announced via Telegram/WhatsApp and require reacceptance before your
          next purchase.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          Contact
        </h2>
        <p>
          Questions about this policy? Contact the store admin via Telegram or
          WhatsApp.
        </p>
      </div>
    </div>
  );
}
