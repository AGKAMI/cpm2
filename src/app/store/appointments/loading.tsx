import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { PanelListSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <PageHeading folio="AP" title="Appointments" backHref="/store/dashboard" />
      <PanelListSkeleton />
    </StoreShell>
  );
}
