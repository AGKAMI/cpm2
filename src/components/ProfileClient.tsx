"use client";

import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";

export function ProfileClient() {
  return (
    <StoreShell>
      <PageHeading folio="04" title="Profile" />
      <div className="panel rounded-xl border border-border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Customer profile</h3>
        <p className="text-muted-foreground">Link your Telegram to see your orders and delivery history here.</p>
      </div>
    </StoreShell>
  );
}
