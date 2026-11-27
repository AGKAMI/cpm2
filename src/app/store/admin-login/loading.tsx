import { StoreShell } from "@/components/StoreShell";
import { AuthSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <AuthSkeleton />
    </StoreShell>
  );
}
