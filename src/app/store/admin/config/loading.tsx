import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { AdminFormSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="CF" title="Store Configuration" backHref="/store/admin" />
      <AdminFormSkeleton />
    </StoreShell>
  );
}
