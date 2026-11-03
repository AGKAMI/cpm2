import { GameRegisterPage } from "@/components/GameRegister";
import { GuestGate } from "@/components/GuestGate";

export const metadata = {
  title: "CPM1 register · Fleet Ledger",
};

export default function Cpm1FleetPage() {
  return <GuestGate><GameRegisterPage game="cpm1" /></GuestGate>;
}
