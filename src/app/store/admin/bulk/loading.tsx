import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { AdminFormSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="BU" title="Bulk Product Upload" backHref="/store/admin" />
      <AdminFormSkeleton />
    </StoreShell>
  );
}
