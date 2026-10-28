import { redirect } from "next/navigation";

/**
 * The old overview dashboard is gone — the owner wants the app dead simple.
 * The CPM2 register is the front door now.
 */
export default function Page() {
  redirect("/fleet/cpm2");
}
