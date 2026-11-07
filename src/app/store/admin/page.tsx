/**
 * VANTA GARAGE — admin product manager (Telegram Mini App).
 * /store/admin
 *
 * Owner-only: gated by STORE_ADMIN_TELEGRAM_ID env var + Telegram initData.
 * Create / edit products from the CPM2 catalog, set pricing, category,
 * stock, exclusivity, and publish state.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { vantaApi, formatPrice, type VantaProduct } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";

type Exclusivity = "standard" | "limited_edition" | "one_of_one";
type Availability = "available" | "limited" | "sold_out" | "unavailable";

type ProductForm = {
  cpm2CarCode: string;
  imageUrl: string;
  name: string;
  description: string;
  basePriceCents: string;
  currency: string;
  stockQuantity: string;
  availabilityState: Availability;
  exclusivity: Exclusivity;
  isFeatured: boolean;
  isPublished: boolean;
};

const EMPTY_FORM: ProductForm = {
  cpm2CarCode: "",
  imageUrl: "",
  name: "",
  description: "",
  basePriceCents: "",
  currency: "ZAR",
  stockQuantity: "0",
  availabilityState: "available",
  exclusivity: "standard",
  isFeatured: false,
  isPublished: true,
};

export default function AdminPage() {
  const router = useRouter();
  const [products, setProducts] = useState<VantaProduct[]>([]);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes] = await Promise.all([
        vantaApi.products({}),
      ]);
      setProducts(pRes.products);
    } catch {
      setError("Couldn't load products or categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const handleChange = (k: keyof ProductForm, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
    setMsg(null);
  };

  const selectProduct = (p: VantaProduct) => {
    setForm({
      cpm2CarCode: String(p.cpm2CarCode ?? ""),
      imageUrl: "",
      name: p.name,
      description: p.description,
      basePriceCents: String(p.basePriceCents),
      currency: p.currency,
      stockQuantity: String(p.stockQuantity),
      availabilityState: p.availabilityState as Availability,
      exclusivity: p.exclusivity as Exclusivity,
      isFeatured: p.isFeatured,
      isPublished: p.isPublished,
    });
    setEditingId(p.id);
    setMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        cpm2CarCode: form.cpm2CarCode ? Number(form.cpm2CarCode) : undefined,
        imageUrl: form.imageUrl || undefined,
        name: form.name,
        description: form.description,
        basePriceCents: Number(form.basePriceCents),
        currency: form.currency,
        stockQuantity: Number(form.stockQuantity),
        availabilityState: form.availabilityState,
        exclusivity: form.exclusivity,
        isFeatured: form.isFeatured,
        isPublished: form.isPublished,
      };
      const url = editingId
        ? `/api/store/admin/products?id=${editingId}`
        : "/api/store/admin/products";
      const resp = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.error?.message ?? `Save failed (${resp.status})`);
      setMsg(editingId ? "Product updated." : "Product created.");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: number, publish: boolean) => {
    const resp = await fetch(`/api/store/admin/products?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: publish }),
    });
    if (!resp.ok) {
      setError("Couldn't update publish state.");
      return;
    }
    setMsg(publish ? "Published." : "Unpublished.");
    await load();
  };

  if (loading) {
    return (
      <StoreShell>
        <p className="text-muted-foreground">Loading admin…</p>
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <PageHeading folio="AD" title="Admin — Product Manager" />
      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {msg && (
        <p className="mb-4 rounded-md border border-primary bg-primary/10 px-3 py-2 text-xs text-primary">
          {msg}
        </p>
      )}

      {/* Create / Edit form */}
      <section className="panel rounded-xl border border-border p-6 mb-8">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          {editingId ? "Edit product" : "Add product"}
        </h3>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="CPM2 car code" hint="From the CPM2 catalog (e.g. 49)">
            <TextInput
              id="cpm2-car-code"
              value={form.cpm2CarCode}
              onChange={(e) => handleChange("cpm2CarCode", e.target.value)}
              placeholder="49"
            />
          </Field>
          <Field label="Image URL" hint="Direct link to the car image">
            <TextInput
              id="image-url"
              value={form.imageUrl}
              onChange={(e) => handleChange("imageUrl", e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label="Name" hint="Vehicle name as you want it shown">
            <TextInput
              id="name"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Toyota Supra MK4"
            />
          </Field>
          <Field label="Price (cents)" hint="R320 000 = 32000000">
            <TextInput
              id="price"
              type="number"
              value={form.basePriceCents}
              onChange={(e) => handleChange("basePriceCents", e.target.value)}
            />
          </Field>
          <Field label="Stock" hint="How many available">
            <TextInput
              id="stock"
              type="number"
              value={form.stockQuantity}
              onChange={(e) => handleChange("stockQuantity", e.target.value)}
            />
          </Field>
          <Field label="Category" hint="Select a category">
            <TextInput
              id="category"
              value={form.currency}
              onChange={() => {}}
              placeholder="Select from categories tab"
              disabled
            />
          </Field>
          <Field label="Availability">
            <select
              id="availability"
              value={form.availabilityState}
              onChange={(e) => handleChange("availabilityState", e.target.value as Availability)}
              className="border border-input bg-background px-3 py-2 rounded-md text-sm"
            >
              <option value="available">Available</option>
              <option value="limited">Limited</option>
              <option value="sold_out">Sold out</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </Field>
          <Field label="Exclusivity">
            <select
              id="exclusivity"
              value={form.exclusivity}
              onChange={(e) => handleChange("exclusivity", e.target.value as Exclusivity)}
              className="border border-input bg-background px-3 py-2 rounded-md text-sm"
            >
              <option value="standard">Standard</option>
              <option value="limited_edition">Limited edition</option>
              <option value="one_of_one">One of One</option>
            </select>
          </Field>
          <Field label="Featured">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => handleChange("isFeatured", e.target.checked)}
              className="accent-primary"
            />
          </Field>
          <Field label="Published">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => handleChange("isPublished", e.target.checked)}
              className="accent-primary"
            />
          </Field>
          <div className="col-span-2 flex gap-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update product" : "Create product"}
            </Button>
            <Button variant="outline" type="button" onClick={resetForm} disabled={saving}>
              Reset
            </Button>
          </div>
        </form>
      </section>

      {/* Product list */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Catalogue</h3>
          <span className="text-xs text-muted-foreground">{products.length} product{products.length === 1 ? "" : "s"}</span>
        </div>
        {products.length === 0 ? (
          <p className="text-muted-foreground">No products yet. Add your first above.</p>
        ) : (
          <div className="grid gap-3">
            {products.map((p) => (
              <article key={p.id} className="panel rounded-xl border border-border p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs font-mono text-muted-foreground">#{p.id}</span>
                  <span className={`text-xs ${p.isPublished ? "text-primary" : "text-muted-foreground"} font-medium capitalize`}>
                    {p.isPublished ? "published" : "unpublished"}
                  </span>
                </div>
                <h4 className="text-sm font-medium text-foreground truncate">{p.name}</h4>
                {p.cpm2CarCode !== null && (
                  <p className="text-[10px] text-muted-foreground mb-2">CPM2 code: {p.cpm2CarCode}</p>
                )}
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-primary font-semibold">{formatPrice(p.basePriceCents, p.currency)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{p.stockQuantity} left</span>
                  {p.exclusivity !== "standard" && (
                    <span className="text-[10px] uppercase tracking-[0.15em] text-accent-foreground border border-accent px-2 py-0.5 rounded ml-2">
                      {p.exclusivity.replace("_", " ")}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectProduct(p)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePublish(p.id, !p.isPublished)}
                  >
                    {p.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6">
        <Button variant="outline" onClick={() => router.push("/store")}>
          Back to store
        </Button>
      </div>
    </StoreShell>
  );
}
