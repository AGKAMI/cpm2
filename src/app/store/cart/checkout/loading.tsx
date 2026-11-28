import { StoreShell } from "@/components/StoreShell";
import { CheckoutSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <CheckoutSkeleton />
    </StoreShell>
  );
}
