import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { OwnerSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="OW" title="Owner Dashboard" backHref="/store/admin" />
      <OwnerSkeleton />
    </StoreShell>
  );
}
