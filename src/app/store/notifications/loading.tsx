import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { NotificationsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="NT" title="Notifications" />
      <NotificationsSkeleton />
    </StoreShell>
  );
}
