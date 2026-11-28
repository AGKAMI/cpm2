import { sweepExpiredReservationsThrottled } from "@/lib/store/jobs";
import type { Metadata } from "next";
import { GameHubShell } from "@/components/GameHubShell";
import { StoreShell } from "@/components/StoreShell";
import { listCategories } from "@/lib/store/products";

export const metadata: Metadata = {
  title: "CPM 1 - CPM STORE",
  description: "CPM1 accounts, car catalogue and services.",
};

export const dynamic = "force-dynamic";

export default async function Cpm1HubPage() {
  // Expire stale reservations on real traffic (throttled to once/60s
  // process-wide, idempotent per order). The queue/cron path never ran it.
  void sweepExpiredReservationsThrottled();
  const categories = await listCategories("cpm1").catch(() => []);

  return (
    <StoreShell>
    <GameHubShell
      game="cpm1"
      title="CPM 1"
      blurb="Pick what you're shopping for."
      categories={categories}
      sections={[
        {
          slug: "accounts",
          label: "Accounts",
          hint: "HD accounts, anime accounts, full car accounts and coin accounts.",
        },
        {
          slug: "cars",
          label: "Cars",
          hint: "The CPM1 car catalogue: every car available as its own listing.",
        },
        {
          slug: "services",
          label: "Services",
          hint: "Callipers, headlights, money injection, coin injection and more.",
        },
      ]}
    />
    </StoreShell>
  );
}