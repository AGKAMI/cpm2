/** VANTA GARAGE — admin promotions management.
 * /store/admin/promotions
 * Admin: create, edit, activate/deactivate promotional banners.
 */

"use client";



import { useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";

type Promotion = {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  discountPercent: number;
  discountCode: string;
  ctaText: string;
  ctaLink: string;
  backgroundColor: string;
  accentColor: string;
  imageUrl: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
};

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<Promotion> | null>(null);

  useEffect(() => {
    loadPromotions();
  }, []);

  async function loadPromotions() {
    try {
      setLoading(true);
      const res = await fetch("/api/store/admin/promotions", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load promotions");
      const data = await res.json();
      setPromotions(data.promotions ?? data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load promotions.");
    } finally {
      setLoading(false);
    }
  }

  async function togglePromotion(id: number, isActive: boolean) {
    try {
      const res = await fetch(`/api/store/admin/promotions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error("Failed to update promotion");
      await loadPromotions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update promotion.");
    }
  }

  async function deletePromotion(id: number) {
    if (!window.confirm("Delete this promotion?")) return;
    try {
      const res = await fetch(`/api/store/admin/promotions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete promotion");
      await loadPromotions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete promotion.");
    }
  }

  async function savePromotion() {
    if (!draft || !draft.title?.trim()) {
      setError("Title is required.");
      return;
    }
    try {
      const isNew = editing === 0;
      const url = isNew
        ? "/api/store/admin/promotions"
        : `/api/store/admin/promotions?id=${editing}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("Failed to save promotion");
      await loadPromotions();
      setEditing(null);
      setDraft(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save promotion.");
    }
  }

  if (loading) {
    return (
      <StoreShell>
        <PageHeading folio="AP" title="Promotions" backHref="/store/admin" />
        <p className="text-muted-foreground">Loading promotions…</p>
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <PageHeading folio="AP" title="Promotions" backHref="/store/admin" />

      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Promotional Banners</h2>
        <Button variant="primary" onClick={() => setEditing(0)}>
          + Add Promotion
        </Button>
      </div>

      {promotions.length === 0 && (
        <p className="text-muted-foreground">No promotions configured.</p>
      )}

      <div className="space-y-4">
        {promotions.map((p) => (
          <PromotionCard
            key={p.id}
            promo={p}
            editing={editing === p.id}
            setEditing={setEditing}
            draft={draft}
            setDraft={setDraft}
            onToggle={() => togglePromotion(p.id, p.isActive)}
            onDelete={() => deletePromotion(p.id)}
            onSave={savePromotion}
          />
        ))}
      </div>
    </StoreShell>
  );
}

function PromotionCard({
  promo,
  editing,
  setEditing,
  draft,
  setDraft,
  onToggle,
  onDelete,
  onSave,
}: {
  promo: Promotion;
  editing: boolean;
  setEditing: (id: number | null) => void;
  draft: Partial<Promotion> | null;
  setDraft: (d: Partial<Promotion> | null) => void;
  onToggle: () => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  const isEditing = editing;
  return (
    <article className="panel rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-base font-bold text-foreground">{promo.title}</h3>
        <span
          className={`text-[9px] font-bold rounded px-2 py-0.5 ${
            promo.isActive
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-ink-faint/10 text-ink-faint border border-ink-faint/20"
          }`}
        >
          {promo.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{promo.description}</p>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-muted-foreground">
          Discount: {promo.discountPercent}% | Code: {promo.discountCode || "—"}
        </span>
        <Button variant="outline" size="sm" onClick={onToggle}>
          {promo.isActive ? "Deactivate" : "Activate"}
        </Button>
        {promo.imageUrl && (
          <img
            src={promo.imageUrl}
            alt="Promo banner"
            className="h-12 w-24 object-cover rounded border border-border"
          />
        )}
      </div>
      {isEditing && draft && (
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block">Title</label>
            <input
              defaultValue={draft.title ?? promo.title}
              className="w-full border border-border bg-surface-deep rounded px-3 py-2 text-sm focus:outline-none focus:border-gold"
              onChange={(e) =>
                setDraft({ ...draft, title: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block">Discount %</label>
            <input
              type="number"
              defaultValue={draft.discountPercent ?? promo.discountPercent}
              className="w-full border border-border bg-surface-deep rounded px-3 py-2 text-sm focus:outline-none focus:border-gold"
              onChange={(e) =>
                setDraft({ ...draft, discountPercent: Number(e.target.value) })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(null);
                setDraft(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={onSave}>
              Save
            </Button>
          </div>
        </div>
      )}
      {!isEditing && (
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={() => setEditing(promo.id)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      )}
    </article>
  );
}
