import { StoreShell } from "@/components/StoreShell";
import { SkeletonHeading, OrderDetailSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <SkeletonHeading />
      <OrderDetailSkeleton />
    </StoreShell>
  );
}
