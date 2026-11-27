import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { AdminStatsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="AD" title="Admin Deliveries" backHref="/store/admin/dashboard" />
      <AdminStatsSkeleton />
    </StoreShell>
  );
}
