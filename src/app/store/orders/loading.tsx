import { StoreShell } from "@/components/StoreShell";
import { OrdersSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <OrdersSkeleton />
    </StoreShell>
  );
}
