import { StoreShell } from "@/components/StoreShell";
import { ProfileSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <ProfileSkeleton />
    </StoreShell>
  );
}
