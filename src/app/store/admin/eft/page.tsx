/***
 * VANTA GARAGE — admin EFT review page.
 * /store/admin/eft
 * Owner-only admin page for reviewing EFT payments, verifying/rejecting,
 * and uploading delivery evidence.
 */

import { Metadata } from "next";
import { EftReviewClient } from "@/components/EftReviewClient";

export const metadata: Metadata = {
  title: "EFT Review - VANTA GARAGE",
  description: "Review and verify EFT payments, upload delivery evidence.",
};

export default function EftReviewPage() {
  return <EftReviewClient />;
}
