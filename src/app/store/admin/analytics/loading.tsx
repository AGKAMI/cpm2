import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { AdminStatsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="AN" title="Analytics & Financial" backHref="/store/admin" />
      <AdminStatsSkeleton />
    </StoreShell>
  );
}
