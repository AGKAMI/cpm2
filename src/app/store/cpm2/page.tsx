import { sweepExpiredReservationsThrottled } from "@/lib/store/jobs";
import type { Metadata } from "next";
import { GameHubShell } from "@/components/GameHubShell";
import { StoreShell } from "@/components/StoreShell";

export const metadata: Metadata = {
  title: "CPM 2 - CPM STORE",
  description: "CPM2 accounts and car catalogue.",
};

export const dynamic = "force-dynamic";

export default function Cpm2HubPage() {
  // Expire stale reservations on real traffic (throttled to once/60s
  // process-wide, idempotent per order). The queue/cron path never ran it.
  void sweepExpiredReservationsThrottled();

  return (
    <StoreShell>
    <GameHubShell
      game="cpm2"
      title="CPM 2"
      blurb="Pick what you're shopping for."
      sections={[
        {
          slug: "accounts",
          label: "Accounts",
          hint: "Ready-to-play CPM2 accounts with money, cars and unlocks.",
        },
        {
          slug: "cars",
          label: "Cars",
          hint: "The CPM2 car catalogue: buy a car direct into an account.",
        },
      ]}
    />
    </StoreShell>
  );
}