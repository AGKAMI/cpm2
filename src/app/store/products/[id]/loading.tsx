import { StoreShell } from "@/components/StoreShell";
import { ProductSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <ProductSkeleton />
    </StoreShell>
  );
}
