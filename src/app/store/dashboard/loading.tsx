import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { DashboardSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="CD" title="Customer Dashboard" />
      <DashboardSkeleton />
    </StoreShell>
  );
}
