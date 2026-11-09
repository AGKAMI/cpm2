import { Metadata } from "next";
import { ProfileClient } from "@/components/ProfileClient";
import { StoreShell } from "@/components/StoreShell";

export const metadata: Metadata = {
  title: "Profile - VANTA GARAGE",
};

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <StoreShell>
      <ProfileClient />
    </StoreShell>
  );
}
