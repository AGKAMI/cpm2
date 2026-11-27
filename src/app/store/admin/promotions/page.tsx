/** VANTA GARAGE — admin promotions management.
 * /store/admin/promotions
 *
 * A promotion is either a banner (campaign) or a PRODUCT promotion: pick a
 * game, attach an existing product, and the promotion overrides that
 * product's displayed price and card styling on the storefront and puts the
 * Promoted pill on its card. The pill's metallic material and shine are fixed
 * — only its colour is chosen here.
 */

"use client";

import { useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { AdminListSkeleton } from "@/components/skeleton";
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
  game: "cpm1" | "cpm2" | null;
  productId: number | null;
  pillColor: string;
};

type ProductOption = { id: number; name: string; game: string };

const PILL_HUES = [
  { label: "Gold", value: "#d4af4f" },
  { label: "Rose", value: "#b76e79" },
  { label: "Copper", value: "#b87333" },
  { label: "Silver", value: "#b8b8c0" },
  { label: "Bronze", value: "#8c6a3f" },
  { label: "Amber", value: "#e08a2e" },
  { label: "Emerald", value: "#2f9e6e" },
  { label: "Sapphire", value: "#3a6fd8" },
  { label: "Ruby", value: "#c23b4e" },
];

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<Promotion> | null>(null);

  useEffect(() => {
    loadPromotions();
    loadProducts();
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

  async function loadProducts() {
    try {
      const res = await fetch("/api/store/admin/products", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const rows: ProductOption[] = (data.products ?? data ?? []).map((p: ProductOption) => ({
        id: Number(p.id),
        name: String(p.name),
        game: String(p.game ?? "cpm2"),
      }));
      setProducts(rows);
    } catch {
      // The product picker is a convenience — its failure must not break the page.
    }
  }

  // The main route owns PUT/DELETE via ?id= (there is no /[id] route; the old
  // page called those paths, so every toggle and delete 404'd).
  async function togglePromotion(id: number, isActive: boolean) {
    try {
      const res = await fetch(`/api/store/admin/promotions?id=${id}`, {
        method: "PUT",
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
      const res = await fetch(`/api/store/admin/promotions?id=${id}`, {
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
    if (!draft.game) {
      setError("Choose which game this promotion is for.");
      return;
    }
    if (!draft.productId) {
      setError("Attach an existing product to this promotion.");
      return;
    }
    const attachedProduct = products.find((p) => p.id === Number(draft.productId));
    if (!attachedProduct) {
      setError("That product no longer exists. Pick another one.");
      return;
    }
    if (attachedProduct.game !== draft.game) {
      setError(`That product belongs to ${attachedProduct.game === "cpm1" ? "CPM 1" : "CPM 2"}. Pick a product in the promotion's game.`);
      return;
    }
    try {
      const isNew = editing === 0;
      const url = isNew
        ? "/api/store/admin/promotions"
        : `/api/store/admin/promotions?id=${editing}`;
      // Ensure the API's required text defaults are present — an empty
      // imageUrl is invalid (z.url()) and must be omitted. Unknown/local keys
      // (id, dates) are stripped by the route's Zod schema.
      const values = draft;
      const body = {
        ...values,
        imageUrl: values.imageUrl || undefined,
        subtitle: values.subtitle || "",
        description: values.description || "",
        discountCode: values.discountCode || "",
        ctaText: values.ctaText || "Shop now",
        ctaLink: values.ctaLink || "/store/categories",
      };
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
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
        <AdminListSkeleton />
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
        <h2 className="text-sm font-semibold text-foreground">Promotions</h2>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(0);
            setDraft({
              title: "",
              description: "",
              discountPercent: 10,
              discountCode: "",
              backgroundColor: "#1c1c1f",
              accentColor: "#d4af4f",
              pillColor: "#d4af4f",
              isActive: true,
              sortOrder: 0,
              game: null,
              productId: null,
            });
          }}
        >
          + Add Promotion
        </Button>
      </div>

      {promotions.length === 0 && editing !== 0 && (
        <p className="text-muted-foreground">No promotions configured.</p>
      )}

      <div className="space-y-4">
        {/* "+ Add Promotion" used to set editing=0 but render nothing for id 0:
            the form existed only inside existing cards. Render a standalone
            card for the new draft so creation is actually possible. */}
        {editing === 0 && draft && (
          <PromotionCard
            promo={{
              id: 0,
              title: "New promotion",
              subtitle: "",
              description: "",
              discountPercent: 0,
              discountCode: "",
              ctaText: "Shop now",
              ctaLink: "/store/categories",
              backgroundColor: "#1c1c1f",
              accentColor: "#d4af4f",
              imageUrl: "",
              isActive: true,
              startDate: null,
              endDate: null,
              sortOrder: 0,
              game: null,
              productId: null,
              pillColor: "#d4af4f",
              ...draft,
            }}
            products={products}
            editing
            setEditing={setEditing}
            draft={draft}
            setDraft={setDraft}
            onToggle={() => undefined}
            onDelete={() => {
              setEditing(null);
              setDraft(null);
            }}
            onSave={savePromotion}
          />
        )}
        {promotions.map((p) => (
          <PromotionCard
            key={p.id}
            promo={p}
            products={products}
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
  products,
  editing,
  setEditing,
  draft,
  setDraft,
  onToggle,
  onDelete,
  onSave,
}: {
  promo: Promotion;
  products: ProductOption[];
  editing: boolean;
  setEditing: (id: number | null) => void;
  draft: Partial<Promotion> | null;
  setDraft: (d: Partial<Promotion> | null) => void;
  onToggle: () => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  const attached = products.find((p) => p.id === promo.productId);
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
      <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-muted-foreground">
        <span>Discount: {promo.discountPercent}%</span>
        <span>Code: {promo.discountCode || "—"}</span>
        <span className="font-bold text-foreground">
          Game: {promo.game === null ? "Both" : promo.game === "cpm1" ? "CPM 1" : "CPM 2"}
        </span>
        {attached && <span className="text-primary">→ {attached.name}</span>}
        {promo.productId !== null && !attached && (
          <span className="text-primary">→ Product #{promo.productId}</span>
        )}
        {/* Pill preview with the chosen hue — the metal + shine are fixed. */}
        <span className="promo-pill" style={{ ["--pill-hue" as string]: promo.pillColor }}>
          Promoted
        </span>
        <Button variant="outline" size="sm" onClick={onToggle}>
          {promo.isActive ? "Deactivate" : "Activate"}
        </Button>
      </div>
      {promo.imageUrl && (
        <img
          src={promo.imageUrl}
          alt="Promo banner"
          className="mb-3 h-12 w-24 object-cover rounded border border-border"
        />
      )}
      {editing && draft && (
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block">Title</label>
            <input
              defaultValue={draft.title ?? promo.title}
              className="w-full border border-border bg-surface-deep rounded px-3 py-2 text-sm focus:outline-none focus:border-gold"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block">Description</label>
            <input
              defaultValue={draft.description ?? promo.description}
              className="w-full border border-border bg-surface-deep rounded px-3 py-2 text-sm focus:outline-none focus:border-gold"
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">Game</label>
              <select
                value={draft.game ?? promo.game ?? ""}
                className="w-full border border-border bg-surface-deep rounded px-3 py-2 text-sm focus:outline-none focus:border-gold"
                onChange={(e) => {
                  const game = e.target.value === "" ? null : (e.target.value as "cpm1" | "cpm2");
                  const selected = products.find((p) => p.id === draft.productId);
                  setDraft({
                    ...draft,
                    game,
                    productId: selected && (!game || selected.game === game) ? draft.productId : null,
                  });
                }}
              >
                <option value="">Both games</option>
                <option value="cpm1">CPM 1</option>
                <option value="cpm2">CPM 2</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block">
              Attached product — required. The promotion overrides the price
              and card of this product on the storefront.
            </label>
            <select
              value={draft.productId ?? promo.productId ?? ""}
              className="w-full border border-border bg-surface-deep rounded px-3 py-2 text-sm focus:outline-none focus:border-gold"
              onChange={(e) =>
                setDraft({
                  ...draft,
                  productId: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Pick an existing product…</option>
              {products
                .filter(
                  (p) =>
                    !draft.game ||
                    !promo.game ||
                    p.game === (draft.game ?? promo.game),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.game === "cpm1" ? "CPM1" : "CPM2"} · {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">Primary colour</label>
              <input
                type="color"
                defaultValue={draft.backgroundColor ?? promo.backgroundColor}
                className="h-9 w-full border border-border bg-surface-deep rounded"
                onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">Secondary colour</label>
              <input
                type="color"
                defaultValue={draft.accentColor ?? promo.accentColor}
                className="h-9 w-full border border-border bg-surface-deep rounded"
                onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block">
              Promoted pill colour — the metallic material and shine are fixed
            </label>
            <div className="flex flex-wrap gap-2">
              {PILL_HUES.map((hue) => (
                <button
                  key={hue.value}
                  type="button"
                  className={`rounded border px-2 py-1 text-[10px] font-bold ${
                    (draft.pillColor ?? promo.pillColor) === hue.value
                      ? "border-primary text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                  onClick={() => setDraft({ ...draft, pillColor: hue.value })}
                >
                  <span className="promo-pill" style={{ ["--pill-hue" as string]: hue.value }}>
                    {hue.label}
                  </span>
                </button>
              ))}
            </div>
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
      {!editing && (
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Seed the draft: previously Save with no changes saw draft=null
              // and always failed with "Title is required."
              setEditing(promo.id);
              // Legacy rows can hold a CSS variable; <input type="color">
              // only accepts hex, so normalise before editing.
              setDraft({
                ...promo,
                backgroundColor: /^#[0-9a-f]{6}$/i.test(promo.backgroundColor)
                  ? promo.backgroundColor
                  : "#1c1c1f",
                accentColor: /^#[0-9a-f]{6}$/i.test(promo.accentColor)
                  ? promo.accentColor
                  : "#d4af4f",
                pillColor: /^#[0-9a-f]{6}$/i.test(promo.pillColor)
                  ? promo.pillColor
                  : "#d4af4f",
              });
            }}
          >
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
