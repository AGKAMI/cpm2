import { StoreShell } from "@/components/StoreShell";
import { CartSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <CartSkeleton />
    </StoreShell>
  );
}
