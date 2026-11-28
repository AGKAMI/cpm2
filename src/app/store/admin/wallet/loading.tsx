import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { AdminWalletSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="AD" title="Admin - Wallet" backHref="/store/admin" />
      <AdminWalletSkeleton />
    </StoreShell>
  );
}
