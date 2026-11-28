import { StoreShell } from "@/components/StoreShell";
import { GameHubSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <StoreShell>
      <GameHubSkeleton />
    </StoreShell>
  );
}
