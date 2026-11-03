import { GameRegisterPage } from "@/components/GameRegister";
import { GuestGate } from "@/components/GuestGate";

export const metadata = {
  title: "CPM2 register · Fleet Ledger",
};

export default function Cpm2FleetPage() {
  return <GuestGate><GameRegisterPage game="cpm2" /></GuestGate>;
}
