import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { AdminListSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="05" title="EFT Review" backHref="/store/admin" />
      <AdminListSkeleton />
    </StoreShell>
  );
}
