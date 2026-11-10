/** VANTA GARAGE — owner dashboard (Telegram Mini App).
 * /store/owner
 * Owner-only: gated by STORE_ADMIN_TELEGRAM_ID env var.
 * Add / remove admins, view store stats.
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { vantaApi, formatPrice, type VantaAdminRecord } from "@/lib/store/client";
import { notifyAdminPromoted } from "@/lib/store/notifications";
import { useToast } from "@/components/ui/Toaster";
import { Toast } from "@/components/ui/Toast";

type AdminRow = VantaAdminRecord & { formattedId: string };

export default function OwnerPage() {
  const router = useRouter();
  const toast = useToast();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newId, setNewId] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [ownerStats, setOwnerStats] = useState<{
    totalCustomers: number;
    totalOrders: number;
    totalRevenueCents: number;
    totalAdmins: number;
    totalProducts: number;
    verifiedOrders: number;
  } | null>(null);

  useEffect(() => {
    loadAdmins();
    loadOwnerStats();
  }, []);

  async function loadOwnerStats() {
    try {
      const res = await vantaApi.ownerStats();
      setOwnerStats(res);
    } catch {
      // Owner stats non-fatal
    }
  }

  async function loadAdmins() {
    setLoading(true);
    try {
      const res = await vantaApi.adminAdmins();
      setAdmins((res.admins ?? []).map((a: VantaAdminRecord) => ({ ...a, formattedId: `tg_${a.telegramUserId}` })));
    } catch (err) {
      toast.error("Failed to load admins.", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newId.trim()) {
      toast.error("Enter a Telegram user ID.");
      return;
    }
    setSaving(true);
    try {
      await vantaApi.createAdmin({ telegramUserId: newId.trim(), telegramUsername: "", nickname: newNickname.trim() });
      // Notify the new admin via Telegram DM
      try {
        await notifyAdminPromoted(Number(newId.trim()), "the owner");
        toast.success("Admin added.", "They’ve been notified via Telegram.");
      } catch {
        toast.success("Admin added.", "Could not send Telegram notification.");
      }
      setNewId("");
      setNewNickname("");
      await loadAdmins();
    } catch (err) {
      toast.error("Failed to add admin.", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(telegramUserId: string) {
    if (!window.confirm("Remove this admin?")) return;
    setSaving(true);
    try {
      await vantaApi.deleteAdmin(telegramUserId);
      toast.success("Admin removed.");
      await loadAdmins();
    } catch (err) {
      toast.error("Failed to remove admin.", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <StoreShell>
        <p className="text-muted-foreground">Loading owner dashboard…</p>
      </StoreShell>
    );

  return (
      <StoreShell>
        <PageHeading folio="OW" title="Owner Dashboard" backHref="/store/admin" meta={ownerStats ? formatPrice(ownerStats.totalRevenueCents) : undefined} />
        {ownerStats && (
          <section className="mb-6">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-[0.15em] mb-3">Store Stats</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <OwnerStatCard label="Customers" value={String(ownerStats.totalCustomers)} />
              <OwnerStatCard label="Total Orders" value={String(ownerStats.totalOrders)} />
              <OwnerStatCard label="Revenue" value={formatPrice(ownerStats.totalRevenueCents)} />
              <OwnerStatCard label="Admins" value={String(ownerStats.totalAdmins)} />
              <OwnerStatCard label="Products Live" value={String(ownerStats.totalProducts)} />
              <OwnerStatCard label="Paid Orders" value={String(ownerStats.verifiedOrders)} />
            </div>
          </section>
        )}

        {/* Add admin */}
        <section className="panel rounded-xl border border-border p-6 mb-8">
          <h3 className="text-sm font-semibold text-foreground mb-4">Add admin</h3>
          <p className="text-[11px] text-muted-foreground mb-4">
            Enter the Telegram user ID of someone you want to make an admin, plus a
            nickname for them. Their actual Telegram name is pulled automatically
            from their profile via their ID. Admins can manage products, pricing, and
            orders - but cannot add or remove other admins.
          </p>
          <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-3">
            <Field label="Telegram user ID" hint="numbers only">
              <TextInput
                id="new-admin-id"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="e.g. 123456789"
                className="flex-1"
              />
            </Field>
            <Field label="Nickname" hint="optional">
              <TextInput
                id="new-admin-nickname"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder="e.g. Chief, Madala, Bro"
                className="flex-1"
              />
            </Field>
            <Button type="submit" variant="primary" disabled={saving || !newId.trim()}>
              {saving ? "Adding…" : "Add admin"}
            </Button>
          </form>
        </section>

        {/* Admin list */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Admins</h3>
            <span className="text-xs text-muted-foreground">{admins.length}</span>
          </div>

          {admins.length === 0 ? (
            <p className="text-muted-foreground">No admins yet. You are the only owner.</p>
          ) : (
            <div className="grid gap-2">
              {admins.map((a) => (
                <article
                  key={a.id}
                  className="panel rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">{a.formattedId}</span>
                    {a.role === "owner" && (
                      <span className="text-[10px] uppercase tracking-[0.15em] text-primary border border-primary px-2 py-0.5 rounded">owner</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {a.nickname ? a.nickname : "-"}
                    {a.telegramUsername ? (
                      <span className="text-ink-faint">· @{a.telegramUsername}</span>
                    ) : null}
                    <span className="text-ink-faint">· {a.role}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemove(a.telegramUserId)}
                      disabled={saving || a.role === "owner"}
                    >
                      Remove
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <Toast />

        <div className="mt-8">
          <Button variant="outline" onClick={() => router.push("/store/admin")}>
            Back to admin
          </Button>
        </div>
      </StoreShell>
  );
}

function OwnerStatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="panel rounded-xl border border-border p-5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">{label}</p>
      <p className="text-xl font-bold text-foreground mt-1">{value}</p>
    </article>
  );
}
