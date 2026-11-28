import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { AdminListSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="AC" title="Account Credentials" backHref="/store/admin" />
      <AdminListSkeleton />
    </StoreShell>
  );
}
