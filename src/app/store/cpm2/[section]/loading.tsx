import { StoreShell } from "@/components/StoreShell";
import { SectionListSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <SectionListSkeleton />
    </StoreShell>
  );
}
