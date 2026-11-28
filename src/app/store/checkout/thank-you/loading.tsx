import { StoreShell } from "@/components/StoreShell";
import { ThankYouSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <ThankYouSkeleton />
    </StoreShell>
  );
}
