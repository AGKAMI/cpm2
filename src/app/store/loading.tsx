import { StoreShell } from "@/components/StoreShell";
import { StoreHomeSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <StoreHomeSkeleton />
    </StoreShell>
  );
}
