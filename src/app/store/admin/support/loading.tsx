import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { AdminListSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="AS" title="Admin Support" backHref="/store/admin" />
      <AdminListSkeleton />
    </StoreShell>
  );
}
