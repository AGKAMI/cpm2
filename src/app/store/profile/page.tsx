import { Metadata } from "next";
import { ProfileClient } from "@/components/ProfileClient";

export const metadata: Metadata = {
  title: "Profile - VANTA GARAGE",
};

export default function ProfilePage() {
  return <ProfileClient />;
}
