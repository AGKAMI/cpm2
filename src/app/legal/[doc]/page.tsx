/** VANTA GARAGE — legal documents.
 * /legal/[doc] — Terms, Privacy, Refund, Delivery, Payment, Cancellation, Appointment, Dispute
 * Static policy pages with versioning.
 */

import { Metadata } from "next";
import type { ReactNode } from "react";
import { getStoreDb } from "@/lib/store-db.ts";

const LEGAL_DOCS: Record<string, { title: string; version: string; body: ReactNode }> = {
  terms: {
    title: "Terms & Conditions",
    version: "1.0",
    body: (
      <>
        <p>
          These Terms & Conditions apply to your use of VANTA GARAGE, the CPM2
          vehicle marketplace operated through the Telegram Mini App and
          WhatsApp. By placing an order, you agree to these terms.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          1. Eligibility
        </h2>
        <p>
          You must be at least 18 years old and have a valid CPM2 Player ID to
          purchase a vehicle. Orders are linked to your Telegram or WhatsApp
          identity.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          2. Placing an Order
        </h2>
        <p>
          When you place an order, we reserve the vehicle for 60 minutes while
          payment is confirmed. You must provide your in-game name and Player ID
          so we can deliver the vehicle in CPM2.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          3. Payment
        </h2>
        <p>
          Payment is made by EFT or PayFast. Your order is confirmed only after
          payment is verified. We do not store full card details.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          4. Delivery
        </h2>
        <p>
          Vehicles are delivered in-game after payment clears. You will be
          offered a delivery appointment slot. Delivery timing depends on seller
          availability.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          5. Limitation of Liability
        </h2>
        <p>
          Vehicles are digital goods in CPM2. We are not responsible for
          in-game losses after delivery, account bans, or CPM2 server issues.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          6. Changes to These Terms
        </h2>
        <p>
          We may update these terms from time to time. Major changes are
          announced via Telegram or WhatsApp. Continued use means you accept the
          updated terms.
        </p>
      </>
    ),
  },
  privacy: {
    title: "Privacy Policy",
    version: "1.0",
    body: (
      <>
        <p>
          This Privacy Policy explains what information VANTA GARAGE collects
          when you use our store through the Telegram Mini App or WhatsApp, and
          how we use it.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          1. Information We Collect
        </h2>
        <p>
          We collect your Telegram or WhatsApp user ID, username (if available),
          CPM2 Player ID, in-game name, order details, and payment confirmation
          status. We do not collect your phone number unless you share it with
          us.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          2. How We Use It
        </h2>
        <p>
          We use your information to process orders, deliver vehicles, contact
          you about your order, and run the store. We do not sell your data to
          third parties.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          3. Sharing
        </h2>
        <p>
          We share order details only with payment providers (PayFast) to
          process payments, and with delivery staff to arrange in-game delivery.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          4. Your Rights
        </h2>
        <p>
          You can ask us to delete your account data at any time by messaging
          the store admin on Telegram or WhatsApp.
        </p>
      </>
    ),
  },
  refund: {
    title: "Refund Policy",
    version: "1.0",
    body: (
      <>
        <p>
          This Refund Policy explains when you can get a refund for a vehicle
          purchased through VANTA GARAGE.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          1. Before Delivery
        </h2>
        <p>
          If your order has not been delivered yet and you change your mind, you
          can request a full refund. Contact the store admin on Telegram or
          WhatsApp with your order number.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          2. After Delivery
        </h2>
        <p>
          Once a vehicle is delivered in CPM2, the sale is final. We do not
          offer refunds after delivery because digital vehicles cannot be
          returned.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          3. Failed Payment
        </h2>
        <p>
          If your payment fails or is rejected, no charge is made and no refund
          is needed. You can place a new order at any time.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          4. How Refunds Are Paid
        </h2>
        <p>
          Approved refunds are paid back through the same method you used to
          pay, within 7 business days.
        </p>
      </>
    ),
  },
  delivery: {
    title: "Delivery Policy",
    version: "1.0",
    body: (
      <>
        <p>
          This Delivery Policy explains how vehicles are delivered to you in
          CPM2 after you buy from VANTA GARAGE.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          1. How Delivery Works
        </h2>
        <p>
          After payment is confirmed, we arrange a delivery appointment. You
          meet the delivery driver in-game at the agreed time to receive your
          vehicle.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          2. Delivery Time
        </h2>
        <p>
          Delivery usually happens within 24 to 48 hours after payment clears,
          depending on driver availability. You will be told the exact time
          before delivery.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          3. Missed Delivery
        </h2>
        <p>
          If you miss your delivery appointment, contact us to reschedule.
          Repeated missed appointments may result in the order being cancelled
          and refunded.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          4. Delivery Location
        </h2>
        <p>
          Delivery happens inside CPM2 at the location agreed with the driver.
          We do not deliver outside the game.
        </p>
      </>
    ),
  },
  payment: {
    title: "Payment Policy",
    version: "1.0",
    body: (
      <>
        <p>
          This Payment Policy explains how you pay for vehicles at VANTA GARAGE
          and what happens after you pay.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          1. Payment Methods
        </h2>
        <p>
          You can pay by EFT (bank transfer) or PayFast (card, Instant EFT, or
          bank transfer). All prices are in South African Rand (ZAR).
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          2. Order Confirmation
        </h2>
        <p>
          Your order is confirmed only after we verify your payment. EFT
          payments may take up to 2 business days to clear.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          3. EFT Proof
        </h2>
        <p>
          If you pay by EFT, upload your proof of payment in the store. We will
          verify it and confirm your order.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          4. Failed Payments
        </h2>
        <p>
          If your payment fails, no order is created and no money is taken. You
          can try again or contact the store admin for help.
        </p>
      </>
    ),
  },
  cancellation: {
    title: "Cancellation Policy",
    version: "1.0",
    body: (
      <>
        <p>
          This Cancellation Policy explains how to cancel an order at VANTA
          GARAGE and what happens when you do.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          1. Before Delivery
        </h2>
        <p>
          You can cancel your order at any time before the vehicle is delivered.
          Contact the store admin on Telegram or WhatsApp with your order number.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          2. After Payment
        </h2>
        <p>
          If you cancel after paying but before delivery, you will receive a
          full refund through your original payment method.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          3. After Delivery
        </h2>
        <p>
          Once the vehicle is delivered in CPM2, the order cannot be cancelled
          and no refund will be given.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          4. How to Cancel
        </h2>
        <p>
          Message the store admin on Telegram or WhatsApp with your order
          number and reason for cancellation.
        </p>
      </>
    ),
  },
  appointment: {
    title: "Appointment Policy",
    version: "1.0",
    body: (
      <>
        <p>
          This Appointment Policy explains how delivery appointments work at
          VANTA GARAGE.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          1. Booking an Appointment
        </h2>
        <p>
          After your payment is confirmed, you can book a delivery appointment.
          Choose a date and time slot that works for you.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          2. Rescheduling
        </h2>
        <p>
          Need a different time? Contact the store admin on Telegram or
          WhatsApp at least 6 hours before your appointment to reschedule.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          3. Missed Appointments
        </h2>
        <p>
          If you miss your appointment without telling us, we will try to
          reschedule once. If you miss a second appointment, the order may be
          cancelled and refunded.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          4. Appointment Confirmation
        </h2>
        <p>
          You will receive a confirmation message on Telegram or WhatsApp with
          your delivery time and in-game meeting location.
        </p>
      </>
    ),
  },
  dispute: {
    title: "Dispute Policy",
    version: "1.0",
    body: (
      <>
        <p>
          This Dispute Policy explains what to do if you have a problem with an
          order from VANTA GARAGE.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          1. Types of Disputes
        </h2>
        <p>
          You can open a dispute for payment problems, delivery issues, wrong
          vehicle delivered, or vehicle not received after payment.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          2. How to Open a Dispute
        </h2>
        <p>
          Message the store admin on Telegram or WhatsApp with your order
          number, a description of the problem, and any proof (screenshots,
          payment receipts).
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          3. Investigation
        </h2>
        <p>
          We will review your dispute within 3 business days. We may ask for
          more information before making a decision.
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">
          4. Resolution
        </h2>
        <p>
          If we find in your favour, you will receive a refund, re-delivery, or
          other remedy. Our decision is final.
        </p>
      </>
    ),
  },
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
      <div className="prose prose-sm max-w-none">{doc.body}</div>
    </div>
  );
}
