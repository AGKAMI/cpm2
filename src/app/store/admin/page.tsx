/**
 * VANTA GARAGE — admin product manager (Telegram Mini App).
 * /store/admin
 *
 * Owner-only: gated by STORE_ADMIN_TELEGRAM_ID env var + Telegram initData.
 * Create / edit products from the CPM2 catalog, set pricing, category,
 * stock, exclusivity, and publish state.
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { carByCode, searchCars, type CarEntry } from "@/lib/car-catalog";
import { vantaApi, formatPrice, type VantaProduct, type VantaCategory, type VantaPromotion } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";

type ProductForm = {
  cpm2CarCode: string;
  imageUrl: string;
  name: string;
  description: string;
  basePriceCents: string;
  currency: string;
  stockQuantity: string;
  airSuspension: boolean;
  unlockedBodykits: boolean;
  hdLogo: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isSale: boolean;
  isPublished: boolean;
  categoryId: string;
};

const EMPTY_FORM: ProductForm = {
  cpm2CarCode: "",
  imageUrl: "",
  name: "",
  description: "",
  basePriceCents: "",
  currency: "ZAR",
  stockQuantity: "0",
  airSuspension: false,
  unlockedBodykits: false,
  hdLogo: false,
  isFeatured: false,
  isNew: false,
  isSale: false,
  isPublished: true,
  categoryId: "",
};

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
};

const EMPTY_CATEGORY_FORM: CategoryForm = {
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
};

type PromotionForm = {
  title: string;
  subtitle: string;
  description: string;
  discountPercent: string;
  discountCode: string;
  ctaText: string;
  ctaLink: string;
  backgroundColor: string;
  accentColor: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: string;
};

const EMPTY_PROMOTION_FORM: PromotionForm = {
  title: "",
  subtitle: "",
  description: "",
  discountPercent: "0",
  discountCode: "",
  ctaText: "Shop now",
  ctaLink: "/store/categories",
  backgroundColor: "#1c1c1f",
  accentColor: "#d4af4f",
  imageUrl: "",
  isActive: true,
  sortOrder: "0",
};

export default function AdminPage() {
  const router = useRouter();
  const [products, setProducts] = useState<VantaProduct[]>([]);
  const [categories, setCategories] = useState<VantaCategory[]>([]);
  const [promotions, setPromotions] = useState<VantaPromotion[]>([]);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [inlineEditingId, setInlineEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Category management state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(EMPTY_CATEGORY_FORM);
  const [categorySaving, setCategorySaving] = useState(false);
  // Promotion management state
  const [showPromotionForm, setShowPromotionForm] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState<number | null>(null);
  const [promotionForm, setPromotionForm] = useState<PromotionForm>(EMPTY_PROMOTION_FORM);
  const [promotionSaving, setPromotionSaving] = useState(false);
  // Car search state for the searchable catalog picker
  const [carQuery, setCarQuery] = useState("");
  const [carOpen, setCarOpen] = useState(false);
  const [pickedCar, setPickedCar] = useState<CarEntry | null>(null);
  // Image URL converter state
  const [converterOpen, setConverterOpen] = useState(false);
  const [converterInput, setConverterInput] = useState("");
  const [converterFile, setConverterFile] = useState<File | null>(null);
  const [converterResult, setConverterResult] = useState<string | null>(null);
  const [converterLoading, setConverterLoading] = useState(false);
  const [converterError, setConverterError] = useState<string | null>(null);
  // Toggle for the add/edit product form (behind a button, not always open)
  const [showProductForm, setShowProductForm] = useState(false);


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes, promoRes] = await Promise.all([
        vantaApi.products({}),
        vantaApi.categories(),
        vantaApi.promotions(),
      ]);
      setProducts(pRes.products);
      setCategories(cRes.categories);
      setPromotions(Array.isArray(promoRes.promotions) ? promoRes.promotions : []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't load products, categories, or promotions.",
      );
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

  const pickCar = (car: CarEntry) => {
    setForm((f) => ({ ...f, cpm2CarCode: String(car.code), name: car.name }));
    setPickedCar(car);
    setCarQuery("");
    setCarOpen(false);
    setError(null);
  };

  const clearPickedCar = () => {
    setPickedCar(null);
    setForm((f) => ({ ...f, cpm2CarCode: "", name: "" }));
  };

  // --- Image URL converter ---
  const convertUrlToDataUrl = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image (${response.status})`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image data"));
      reader.readAsDataURL(blob);
    });
  };

  const convertFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
  };

  const handleConvertUrl = async () => {
    if (!converterInput.trim()) {
      setConverterError("Please paste an image URL.");
      return;
    }
    setConverterLoading(true);
    setConverterError(null);
    try {
      const dataUrl = await convertUrlToDataUrl(converterInput.trim());
      setConverterResult(dataUrl);
    } catch (err) {
      setConverterError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setConverterLoading(false);
    }
  };

  const handleConvertFile = async () => {
    if (!converterFile) {
      setConverterError("Please select an image file.");
      return;
    }
    setConverterLoading(true);
    setConverterError(null);
    try {
      const dataUrl = await convertFileToDataUrl(converterFile);
      setConverterResult(dataUrl);
    } catch (err) {
      setConverterError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setConverterLoading(false);
    }
  };

  const useConverterResult = () => {
      if (converterResult) {
        setForm((f) => ({ ...f, imageUrl: converterResult }));
        // Keep converter open with preview visible until user closes modal
        setConverterInput("");
        setConverterFile(null);
        setConverterError(null);
        setConverterLoading(false);
      }
    };

    const resetConverter = () => {
      setConverterInput("");
      setConverterFile(null);
      setConverterResult(null);
      setConverterError(null);
      setConverterLoading(false);
    };

    const resetForm = () => {
      setForm(EMPTY_FORM);
      setPickedCar(null);
      setEditingId(null);
      setInlineEditingId(null);
      setError(null);
      setMsg(null);
    };

    const resetCategoryForm = () => {
      setCategoryForm(EMPTY_CATEGORY_FORM);
      setShowCategoryForm(false);
    };

    const selectProduct = (p: VantaProduct) => {
      setForm({
        cpm2CarCode: String(p.cpm2CarCode ?? ""),
        imageUrl: "",
        name: p.name,
        description: p.description,
        basePriceCents: String(p.basePriceCents / 100), // display in Rands
        currency: p.currency,
        stockQuantity: String(p.stockQuantity),
        airSuspension: p.airSuspension,
        unlockedBodykits: p.unlockedBodykits,
        hdLogo: false,
        isFeatured: p.isFeatured,
        isNew: p.isNew,
        isSale: p.isSale,
        isPublished: p.isPublished,
        categoryId: String(p.categoryId ?? ""),
      });
      setEditingId(p.id);
      setInlineEditingId(p.id);
      setMsg(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setError(null);
      // Catalog guard (mirrors the server-side check): a typed/hand-edited code
      // that isn't a real CPM2 catalog car never reaches the API.
      if (form.cpm2CarCode && !carByCode(Number(form.cpm2CarCode), "cpm2")) {
        setError(`CPM2 catalog has no car #${form.cpm2CarCode}. Pick a car from the catalog search.`);
        setSaving(false);
        return;
      }
      try {
        const body = {
          cpm2CarCode: form.cpm2CarCode ? Number(form.cpm2CarCode) : undefined,
          imageUrl: form.imageUrl || undefined,
          name: form.name,
          description: form.description,
          basePriceCents: Math.round(Number(form.basePriceCents) * 100), // Rands → cents
          currency: form.currency,
          stockQuantity: Number(form.stockQuantity),
          airSuspension: form.airSuspension,
          unlockedBodykits: form.unlockedBodykits,
          hdLogo: form.hdLogo,
          isFeatured: form.isFeatured,
          isNew: form.isNew,
          isSale: form.isSale,
          isPublished: form.isPublished,
          categoryId: form.categoryId ? Number(form.categoryId) : undefined,
        };
        if (editingId) {
          await vantaApi.updateProduct(editingId, body);
        } else {
          await vantaApi.createProduct(body);
        }
        setMsg(editingId ? "Product updated." : "Product created.");
        resetForm();
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setSaving(false);
      }
    };

    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCategorySaving(true);
        setError(null);
        try {
          await vantaApi.createCategory({
            name: categoryForm.name,
            slug: categoryForm.slug,
            description: categoryForm.description,
            sortOrder: Number(categoryForm.sortOrder) || 0,
          });
          setMsg("Category created.");
          resetCategoryForm();
          await load();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to create category.");
        } finally {
          setCategorySaving(false);
        }
      };

    // --- Promotion management ---

    const resetPromotionForm = () => {
      setPromotionForm(EMPTY_PROMOTION_FORM);
      setEditingPromotionId(null);
      setMsg(null);
    };

    const selectPromotion = (p: VantaPromotion) => {
      setPromotionForm({
        title: p.title,
        subtitle: p.subtitle,
        description: p.description,
        discountPercent: String(p.discountPercent),
        discountCode: p.discountCode,
        ctaText: p.ctaText,
        ctaLink: p.ctaLink,
        backgroundColor: p.backgroundColor,
        accentColor: p.accentColor,
        imageUrl: p.imageUrl,
        isActive: p.isActive,
        sortOrder: String(p.sortOrder),
      });
      setEditingPromotionId(p.id);
      setMsg(null);
    };

    const handlePromotionSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setPromotionSaving(true);
      setError(null);
      try {
        const body = {
          title: promotionForm.title,
          subtitle: promotionForm.subtitle || undefined,
          description: promotionForm.description || undefined,
          discountPercent: Number(promotionForm.discountPercent) || 0,
          discountCode: promotionForm.discountCode || undefined,
          ctaText: promotionForm.ctaText || "Shop now",
          ctaLink: promotionForm.ctaLink || "/store/categories",
          backgroundColor: promotionForm.backgroundColor || "#1c1c1f",
          accentColor: promotionForm.accentColor || "#d4af4f",
          imageUrl: promotionForm.imageUrl || undefined,
          isActive: promotionForm.isActive,
          sortOrder: Number(promotionForm.sortOrder) || 0,
        };
        if (editingPromotionId) {
          await vantaApi.updatePromotion(editingPromotionId, body);
        } else {
          await vantaApi.createPromotion(body);
        }
        setMsg(editingPromotionId ? "Promotion updated." : "Promotion created.");
        resetPromotionForm();
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save promotion.");
      } finally {
        setPromotionSaving(false);
      }
    };

    const handlePromotionDelete = async (id: number) => {
      if (!window.confirm(`Delete this promotion?`)) return;
      setError(null);
      try {
        await vantaApi.deletePromotion(id);
        setMsg("Promotion deleted.");
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete promotion.");
      }
    };

    const handlePublish = async (id: number, publish: boolean) => {
      setError(null);
      try {
        const scrollY = window.scrollY;
        await vantaApi.updateProductPublish(id, publish);
        setMsg(publish ? "Published." : "Unpublished.");
        await load();
        window.scrollTo(0, scrollY);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update publish state.");
      }
    };

    const handleCategoryChange = (k: keyof CategoryForm, v: string) => {
      setCategoryForm((f) => ({ ...f, [k]: v }));
      // Auto-generate slug from name
      if (k === "name" && !categoryForm.slug) {
        setCategoryForm((f) => ({ ...f, slug: v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") }));
      }
    };

  if (loading) {
        return (
          <StoreShell>
            <PageHeading folio="AD" title="Admin - Product Manager" backHref="/store" />
            <p className="text-muted-foreground">Loading admin…</p>
          </StoreShell>
        );
      }

    // Car codes are set-once: locked for editing when the product already has one.
    const carLocked = editingId !== null && form.cpm2CarCode !== "";

    // Searchable catalog matches (name-only, no codes visible)
    const carMatches = searchCars(carQuery, 30, "cpm2");

    return (
          <StoreShell>
            <PageHeading folio="AD" title="Admin - Product Manager" backHref="/store" />
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

        {/* Category Management */}
        <section className="panel rounded-xl border border-border p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Categories</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCategoryForm(!showCategoryForm)}
            >
              {showCategoryForm ? "Hide" : "Add Category"}
            </Button>
          </div>
          {showCategoryForm && (
            <form onSubmit={handleCategorySubmit} className="grid gap-3 sm:grid-cols-2 mb-4">
              <Field label="Name">
                <TextInput
                  value={categoryForm.name}
                  onChange={(e) => handleCategoryChange("name", e.target.value)}
                  placeholder="e.g. Sports Cars"
                />
              </Field>
              <Field label="Slug" hint="Auto-generated from name, used in URLs">
                <TextInput
                  value={categoryForm.slug}
                  onChange={(e) => handleCategoryChange("slug", e.target.value)}
                  placeholder="sports-cars"
                />
              </Field>
              <Field label="Description" hint="Optional description">
                            <textarea
                              value={categoryForm.description}
                              onChange={(e) => handleCategoryChange("description", e.target.value)}
                              placeholder="Optional description"
                              className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground min-h-[60px] resize-y sm:col-span-2"
                            />
                          </Field>
              <Field label="Sort Order" hint="Lower numbers appear first">
                <input
                  type="number"
                  value={categoryForm.sortOrder}
                  onChange={(e) => handleCategoryChange("sortOrder", e.target.value)}
                  className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
                />
              </Field>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" variant="primary" disabled={categorySaving}>
                  {categorySaving ? "Creating…" : "Create Category"}
                </Button>
                <Button variant="outline" type="button" onClick={resetCategoryForm} disabled={categorySaving}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            {categories.length === 0 ? (
              <span className="text-xs text-muted-foreground">No categories yet. Click &quot;Add Category&quot; to create one.</span>
            ) : (
              categories.map((cat) => (
                <span
                  key={cat.id}
                  className="text-xs px-2 py-1 rounded-full border border-border bg-background text-foreground"
                >
                  {cat.name} ({cat.slug})
                </span>
              ))
            )}
          </div>
        </section>

      {/* Promotions Management */}
            <section className="panel rounded-xl border border-border p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Promotions</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPromotionForm(true);
                    setEditingPromotionId(null);
                    setPromotionForm(EMPTY_PROMOTION_FORM);
                    setMsg(null);
                    setError(null);
                  }}
                >
                  {showPromotionForm ? "Hide form" : "Add Promotion"}
                </Button>
              </div>

              {showPromotionForm && (
                <form onSubmit={handlePromotionSubmit} className="grid gap-3 sm:grid-cols-2 mb-4">
                  <Field label="Title">
                    <TextInput
                      value={promotionForm.title}
                      onChange={(e) => setPromotionForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Founders Weekend"
                    />
                  </Field>
                  <Field label="Subtitle (eyebrow text)">
                    <TextInput
                      value={promotionForm.subtitle}
                      onChange={(e) => setPromotionForm((f) => ({ ...f, subtitle: e.target.value }))}
                      placeholder="Special offer"
                    />
                  </Field>
                  <Field label="Description">
                    <TextInput
                      value={promotionForm.description}
                      onChange={(e) => setPromotionForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="10% off every Limited Edition"
                    />
                  </Field>
                  <Field label="Discount %">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={promotionForm.discountPercent}
                      onChange={(e) => setPromotionForm((f) => ({ ...f, discountPercent: e.target.value }))}
                      className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
                    />
                  </Field>
                  <Field label="Discount Code">
                    <TextInput
                      value={promotionForm.discountCode}
                      onChange={(e) => setPromotionForm((f) => ({ ...f, discountCode: e.target.value }))}
                      placeholder="VANTA10"
                    />
                  </Field>
                  <Field label="CTA Text">
                    <TextInput
                      value={promotionForm.ctaText}
                      onChange={(e) => setPromotionForm((f) => ({ ...f, ctaText: e.target.value }))}
                      placeholder="Shop now"
                    />
                  </Field>
                  <Field label="CTA Link">
                    <TextInput
                      value={promotionForm.ctaLink}
                      onChange={(e) => setPromotionForm((f) => ({ ...f, ctaLink: e.target.value }))}
                      placeholder="/store/categories"
                    />
                  </Field>
                  <Field label="Background Color">
                    <input
                      type="color"
                      value={promotionForm.backgroundColor}
                      onChange={(e) => setPromotionForm((f) => ({ ...f, backgroundColor: e.target.value }))}
                      className="w-full h-10 border-none bg-transparent cursor-pointer"
                    />
                  </Field>
                  <Field label="Accent Color">
                    <input
                      type="color"
                      value={promotionForm.accentColor}
                      onChange={(e) => setPromotionForm((f) => ({ ...f, accentColor: e.target.value }))}
                      className="w-full h-10 border-none bg-transparent cursor-pointer"
                    />
                  </Field>
                  <Field label="Image URL (optional background image)">
                    <TextInput
                      value={promotionForm.imageUrl}
                      onChange={(e) => setPromotionForm((f) => ({ ...f, imageUrl: e.target.value }))}
                      placeholder="https://..."
                    />
                  </Field>
                  <Field label="Active">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={promotionForm.isActive}
                        onChange={(e) => setPromotionForm((f) => ({ ...f, isActive: e.target.checked }))}
                        className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <span className="text-sm text-foreground">Show on home page</span>
                    </div>
                  </Field>
                  <Field label="Sort Order">
                    <input
                      type="number"
                      value={promotionForm.sortOrder}
                      onChange={(e) => setPromotionForm((f) => ({ ...f, sortOrder: e.target.value }))}
                      className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
                    />
                  </Field>
                  <div className="sm:col-span-2 flex gap-2">
                    <Button type="submit" variant="primary" disabled={promotionSaving}>
                      {promotionSaving ? "Saving…" : editingPromotionId ? "Update Promotion" : "Create Promotion"}
                    </Button>
                    <Button variant="outline" type="button" onClick={resetPromotionForm} disabled={promotionSaving}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              <div className="flex flex-wrap gap-3">
                {promotions.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No promotions yet. Click "Add Promotion" to create one.</span>
                ) : (
                  promotions.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-surface-deep"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-muted-foreground">#{p.id}</span>
                          {p.isActive ? (
                            <span className="text-[10px] text-primary font-bold">ACTIVE</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">INACTIVE</span>
                          )}
                        </div>
                        <h4 className="text-sm font-medium text-foreground truncate">{p.title}</h4>
                        <p className="text-[10px] text-ink-soft truncate">
                          {p.description || p.subtitle || ""}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          {p.discountCode && (
                            <span className="text-[10px] font-bold text-gold">{p.discountCode}</span>
                          )}
                          {p.discountPercent > 0 && (
                            <span className="text-[10px] text-muted-foreground">{p.discountPercent}% off</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{p.ctaText}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-ink-faint">bg: {p.backgroundColor}</span>
                          <span className="text-[10px] text-ink-faint">accent: {p.accentColor}</span>
                          {p.imageUrl && <span className="text-[10px] text-ink-faint">🖼️ image</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => selectPromotion(p)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePromotionDelete(p.id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

      {/* Create / Edit form - hidden when editing inline within a card */}
            {!inlineEditingId && showProductForm && (
              <section className="panel rounded-xl border border-border p-6 mb-8">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                {editingId ? "Edit product" : "Add product"}
              </h3>
              <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Field
            label="Car (CPM2 catalog)"
            hint={
              carLocked
                ? "Locked - car codes are set once at creation and cannot be changed"
                : editingId !== null
                  ? "No car linked yet - pick one; the code locks once set"
                  : "Pick a car from the catalog - it auto-fills the name below, then you can edit it"
            }
          >
            {carLocked ? (
              <select
                id="cpm2-car-code"
                disabled
                defaultValue={form.cpm2CarCode}
                aria-readonly="true"
                className="w-full border border-input bg-secondary px-3 py-2 rounded-md text-sm text-foreground cursor-not-allowed"
              >
                <option value={form.cpm2CarCode}>
                  {carByCode(Number(form.cpm2CarCode), "cpm2")?.name ?? `#${form.cpm2CarCode}`}
                </option>
              </select>
            ) : pickedCar ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-muted-foreground">#{pickedCar.code}</span>
                  <span className="text-foreground">{pickedCar.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearPickedCar}
                    aria-label="Clear picked car"
                  >
                    ✕
                  </Button>
                </div>
                <div className="border border-input rounded-md px-2 py-1 bg-background">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Picked from catalog - name below is editable
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative" onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setCarOpen(false);
              }}>
                <input
                  id="cpm2-car-code"
                  value={carQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCarQuery(v);
                    setCarOpen(true);
                    if (v === "") {
                      setForm((f) => ({ ...f, cpm2CarCode: "", name: "" }));
                      setPickedCar(null);
                    }
                  }}
                  onFocus={() => setCarOpen(true)}
                  placeholder="Type a car name or code…"
                  autoComplete="off"
                  className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
                />
                {carOpen && (carMatches.length > 0 ? (
                  <div
                    className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-border rounded-md bg-card shadow-lg"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {carMatches.map((car) => (
                      <button
                        key={car.code}
                        type="button"
                        onClick={() => pickCar(car)}
                        className="block w-full text-left px-3 py-2 text-sm bg-card hover:bg-background hover:border-primary border-b border-border last:border-b-0"
                      >
                        <span className="text-foreground">{car.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="absolute z-20 mt-1 w-full border border-border rounded-md bg-card px-3 py-2 text-sm text-muted-foreground">
                    No car in the CPM2 catalog matches &quot;{carQuery}&quot;.
                  </div>
                ))}
              </div>
            )}
          </Field>
          <Field label="Image URL" hint="Direct link to the car image, or use Convert to turn a URL/file into a data URL">
            <div className="flex gap-2">
              <TextInput
                id="image-url"
                value={form.imageUrl}
                onChange={(e) => handleChange("imageUrl", e.target.value)}
                placeholder="https://..."
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetConverter();
                  setConverterOpen(true);
                }}
              >
                Convert image
              </Button>
            </div>
          </Field>
          <Field label="Name" hint='Auto-filled from the catalog pick above - edit for custom design names (e.g. "GOLF GTI III - Midnight Chrome")'>
            <TextInput
              id="name"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Toyota Supra MK4"
            />
          </Field>
          <Field label="Price (ZAR)" hint="Enter price in Rands, e.g. 60.00">
            <input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={form.basePriceCents}
              onChange={(e) => handleChange("basePriceCents", e.target.value)}
              className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
            />
          </Field>
          <Field
            label="Stock"
            hint={editingId === null ? "Must be at least 1 when adding a new car" : "How many available - set to 0 to mark out of stock"}
          >
            <input
              id="stock"
              type="number"
              min={editingId === null ? 1 : 0}
              value={form.stockQuantity}
              onChange={(e) => handleChange("stockQuantity", e.target.value)}
              className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
            />
          </Field>
          <Field label="Category" hint={categories.length === 0 ? "No categories yet - add some via the Categories tab" : "Select a category for filtering"}>
            <select
              id="category"
              value={form.categoryId}
              onChange={(e) => handleChange("categoryId", e.target.value)}
              className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Air suspension install" hint="This design includes air suspension installation">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="air-suspension"
                checked={form.airSuspension}
                onChange={(e) => handleChange("airSuspension", e.target.checked)}
                className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-sm text-foreground">Include air suspension</span>
            </div>
          </Field>
          <Field label="Unlocked bodykits" hint="This design unlocks bodykits">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="unlocked-bodykits"
                checked={form.unlockedBodykits}
                onChange={(e) => handleChange("unlockedBodykits", e.target.checked)}
                className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-sm text-foreground">Include unlocked bodykits</span>
            </div>
          </Field>
          <Field label="HD Logo" hint="This design includes a high-definition logo">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hd-logo"
                checked={form.hdLogo}
                onChange={(e) => handleChange("hdLogo", e.target.checked)}
                className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-sm text-foreground">Include HD logo</span>
            </div>
          </Field>
          <Field label="Featured">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.isFeatured}
                          onChange={(e) => handleChange("isFeatured", e.target.checked)}
                          className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <span className="text-sm text-foreground">Featured on home page</span>
                      </div>
                    </Field>
                    <Field label="New Arrival">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.isNew}
                          onChange={(e) => handleChange("isNew", e.target.checked)}
                          className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <span className="text-sm text-foreground">Show &quot;New&quot; badge</span>
                      </div>
                    </Field>
                    <Field label="Sale">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.isSale}
                          onChange={(e) => handleChange("isSale", e.target.checked)}
                          className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <span className="text-sm text-foreground">Show &quot;Sale&quot; badge</span>
                      </div>
                    </Field>
                    <Field label="Published">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => handleChange("isPublished", e.target.checked)}
                className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-sm text-foreground">Visible to customers</span>
            </div>
          </Field>
          <div className="col-span-2 sm:col-span-2 lg:col-span-3 xl:col-span-4 flex gap-2 flex-wrap">
                      <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? "Saving…" : editingId ? "Update product" : "Create product"}
                      </Button>
                      <Button variant="outline" type="button" onClick={resetForm} disabled={saving}>
                        Reset
                      </Button>
                    </div>
                  </form>
                </section>
                )}

                {/* Product list */}
                <section className="space-y-3">
                  <div className="flex items-baseline justify-between mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Catalogue</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{products.length} product{products.length === 1 ? "" : "s"}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowProductForm(true);
                          setEditingId(null);
                          setForm(EMPTY_FORM);
                          setPickedCar(null);
                          setMsg(null);
                          setError(null);
                        }}
                      >
                        {showProductForm ? "Hide form" : "Add product"}
                      </Button>
                    </div>
                  </div>
                  {products.length === 0 ? (
                    <p className="text-muted-foreground">No products yet. Add your first above.</p>
                  ) : (
                    <div className="grid gap-3">
                      {products.map((p) => {
                        const isInline = inlineEditingId === p.id;
                        if (isInline) {
                          return (
                            <article key={p.id} className="panel rounded-xl border border-border p-4">
                              <div className="flex items-baseline justify-between mb-3">
                                <span className="text-xs font-mono text-muted-foreground">#{p.id}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setInlineEditingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="Car (CPM2 catalog)"
                        hint={carLocked ? "Car code is locked - set once at creation" : "Pick a car from the catalog - name auto-fills below"}
                      >
                        {carLocked ? (
                          <select
                            id="cpm2-car-code"
                            disabled
                            defaultValue={form.cpm2CarCode}
                            aria-readonly="true"
                            className="w-full border border-input bg-secondary px-3 py-2 rounded-md text-sm text-foreground cursor-not-allowed"
                          >
                            <option value={form.cpm2CarCode}>
                              {carByCode(Number(form.cpm2CarCode), "cpm2")?.name ?? `#${form.cpm2CarCode}`}
                            </option>
                          </select>
                        ) : pickedCar ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-muted-foreground">#{pickedCar.code}</span>
                              <span className="text-foreground">{pickedCar.name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearPickedCar}
                                aria-label="Clear picked car"
                              >
                                ✕
                              </Button>
                            </div>
                            <div className="border border-input rounded-md px-2 py-1 bg-background">
                              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                                Picked from catalog - name below is editable
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="relative" onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) setCarOpen(false);
                          }}>
                            <input
                              id="cpm2-car-code"
                              value={carQuery}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCarQuery(v);
                                setCarOpen(true);
                                if (v === "") {
                                  setForm((f) => ({ ...f, cpm2CarCode: "", name: "" }));
                                  setPickedCar(null);
                                }
                              }}
                              onFocus={() => setCarOpen(true)}
                              placeholder="Type a car name or code…"
                              autoComplete="off"
                              className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
                            />
                            {carOpen && (carMatches.length > 0 ? (
                              <div
                                className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-border rounded-md bg-card shadow-lg"
                                onMouseDown={(e) => e.preventDefault()}
                              >
                                {carMatches.map((car) => (
                                  <button
                                    key={car.code}
                                    type="button"
                                    onClick={() => pickCar(car)}
                                    className="block w-full text-left px-3 py-2 text-sm bg-card hover:bg-background hover:border-primary border-b border-border last:border-b-0"
                                  >
                                    <span className="text-foreground">{car.name}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="absolute z-20 mt-1 w-full border border-border rounded-md bg-card px-3 py-2 text-sm text-muted-foreground">
                                No car in the CPM2 catalog matches &quot;{carQuery}&quot;.
                              </div>
                            ))}
                          </div>
                        )}
                      </Field>
                      <Field label="Name" hint='Auto-filled from the catalog pick above - edit for custom design names (e.g. "GOLF GTI III - Midnight Chrome")'>
                        <TextInput
                          id="name"
                          value={form.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                          placeholder="Toyota Supra MK4"
                        />
                      </Field>
                      <Field label="Price (ZAR)">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.basePriceCents}
                          onChange={(e) => handleChange("basePriceCents", e.target.value)}
                          className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
                        />
                      </Field>
                      <Field
                        label="Stock"
                        hint={editingId === null ? "Must be at least 1 when adding a new car" : "How many available - set to 0 to mark out of stock"}
                      >
                        <input
                          type="number"
                          min={editingId === null ? 1 : 0}
                          value={form.stockQuantity}
                          onChange={(e) => handleChange("stockQuantity", e.target.value)}
                          className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
                        />
                      </Field>
                      <Field label="Category" hint={categories.length === 0 ? "No categories yet - add some via the Categories tab" : "Select a category"}>
                        <select
                          value={form.categoryId}
                          onChange={(e) => handleChange("categoryId", e.target.value)}
                          className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
                        >
                          <option value="">Select a category</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Air suspension install">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.airSuspension}
                            onChange={(e) => handleChange("airSuspension", e.target.checked)}
                            className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <span className="text-sm text-foreground">Include air suspension</span>
                        </div>
                      </Field>
                      <Field label="Unlocked bodykits">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.unlockedBodykits}
                            onChange={(e) => handleChange("unlockedBodykits", e.target.checked)}
                            className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <span className="text-sm text-foreground">Include unlocked bodykits</span>
                        </div>
                      </Field>
                      <Field label="HD Logo">
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="checkbox"
                                                  checked={form.hdLogo}
                                                  onChange={(e) => handleChange("hdLogo", e.target.checked)}
                                                  className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                                                />
                                                <span className="text-sm text-foreground">Include HD logo</span>
                                              </div>
                                            </Field>
                                            <Field label="New Arrival">
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="checkbox"
                                                  checked={form.isNew}
                                                  onChange={(e) => handleChange("isNew", e.target.checked)}
                                                  className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                                                />
                                                <span className="text-sm text-foreground">Show &quot;New&quot; badge</span>
                                              </div>
                                            </Field>
                                            <Field label="Sale">
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="checkbox"
                                                  checked={form.isSale}
                                                  onChange={(e) => handleChange("isSale", e.target.checked)}
                                                  className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                                                />
                                                <span className="text-sm text-foreground">Show &quot;Sale&quot; badge</span>
                                              </div>
                                            </Field>
                                            <Field label="Published">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.isPublished}
                            onChange={(e) => handleChange("isPublished", e.target.checked)}
                            className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <span className="text-sm text-foreground">Visible to customers</span>
                        </div>
                      </Field>
                      <div className="col-span-2 flex gap-2">
                        <Button type="submit" variant="primary" disabled={saving}>
                          {saving ? "Saving…" : "Update product"}
                        </Button>
                      </div>
                    </form>
                  </article>
                );
              }
              return (
                <article
                  key={p.id}
                  className={`panel rounded-xl border p-4 ${
                    p.stockQuantity === 0
                      ? "border-oxblood bg-oxblood/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs font-mono text-muted-foreground">#{p.id}</span>
                    <span className={`text-xs ${p.isPublished ? "text-primary" : "text-muted-foreground"} font-medium capitalize`}>
                      {p.isPublished ? "published" : "unpublished"}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-foreground truncate">{p.name}</h4>
                                    <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                                      <span className="text-primary font-semibold">{formatPrice(p.basePriceCents, p.currency)}</span>
                                      <span
                                        className={`text-xs ml-2 font-medium ${
                                          p.stockQuantity === 0
                                            ? "text-oxblood"
                                            : "text-muted-foreground"
                                        }`}
                                      >
                                        {p.stockQuantity === 0 ? "Out of stock" : `${p.stockQuantity} left`}
                                      </span>
                                      {p.categoryId && categories.length > 0 && (
                                        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground border border-border px-2 py-0.5 rounded ml-2">
                                          {categories.find((c) => c.id === p.categoryId)?.name ?? "Category"}
                                        </span>
                                      )}
                                      {p.exclusivity !== "standard" && (
                                        <span className="text-[10px] uppercase tracking-[0.15em] text-accent-foreground border border-accent px-2 py-0.5 rounded ml-2">
                                          {p.exclusivity.replace("_", " ")}
                                        </span>
                                      )}
                                      {p.isNew && (
                                        <span className="bd bd-new text-[10px] font-bold px-2 py-0.5 rounded">New</span>
                                      )}
                                      {p.isSale && (
                                        <span className="bd bd-sale text-[10px] font-bold px-2 py-0.5 rounded">Sale</span>
                                      )}
                                      {p.isFeatured && (
                                        <span className="bd bd-featured text-[10px] font-bold px-2 py-0.5 rounded">Featured</span>
                                      )}
                                    </div>
                                    {p.stockQuantity === 0 && (
                                      <p className="text-[10px] uppercase tracking-[0.15em] text-oxblood mt-1">
                                        Out of stock - edit to restock
                                      </p>
                                    )}
                                    <div className="flex gap-2 flex-wrap">
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
                                      <Button
                                                                              variant="ghost"
                                                                              size="sm"
                                                                              onClick={async () => {
                                                                                if (!window.confirm(`Delete "${p.name}"? This will unpublish and mark unavailable.`)) return;
                                                                                setError(null);
                                                                                // Remember scroll position so the page doesn't jump to top after refresh
                                                                                const scrollY = window.scrollY;
                                                                                try {
                                                                                  await vantaApi.deleteProduct(p.id);
                                                                                  setMsg("Product deleted (unpublished & marked unavailable).");
                                                                                  await load();
                                                                                  window.scrollTo(0, scrollY);
                                                                                } catch (err) {
                                                                                  setError(err instanceof Error ? err.message : "Failed to delete product.");
                                                                                }
                                                                              }}
                                                                              className="text-destructive hover:bg-destructive/10"
                                                                            >
                                                                              Delete
                                      </Button>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          )}
                        </section>

                        <div className="mt-6 flex gap-2 flex-wrap">
                          <Button variant="outline" onClick={() => router.push("/store")}>
                            Back to store
                          </Button>
                          <Link href="/store/admin/eft" className="flex items-center gap-2 px-4 py-2 text-[9px] uppercase tracking-[0.15em] whitespace-nowrap cursor-pointer font-bold text-ink-soft">
                            EFT Review
                          </Link>
                        </div>

      {/* Image URL converter modal */}
      <Modal
        open={converterOpen}
        onClose={() => setConverterOpen(false)}
        title="Image URL Converter"
        subtitle="Convert an image URL or file into a data URL you can paste as the product image"
        width="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-foreground mb-2">Option 1: Image URL</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={converterInput}
                onChange={(e) => setConverterInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="flex-1 border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleConvertUrl}
                disabled={converterLoading || !converterInput.trim()}
              >
                {converterLoading ? "Converting…" : "Convert URL"}
              </Button>
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <p className="text-xs font-medium text-foreground mb-2">Option 2: Upload image file</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setConverterFile(file);
                if (file) setConverterInput(""); // clear URL when file selected
              }}
              className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary"
            />
            {converterFile && (
              <p className="text-xs text-muted-foreground mt-1">
                {converterFile.name} ({Math.round(converterFile.size / 1024)} KB)
              </p>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleConvertFile}
              disabled={converterLoading || !converterFile}
              className="mt-2"
            >
              {converterLoading ? "Converting…" : "Convert file"}
            </Button>
          </div>

          {converterError && (
            <p className="text-xs text-destructive">{converterError}</p>
          )}

          {converterResult && (
            <div className="pt-3 border-t border-border space-y-3">
              <p className="text-xs font-medium text-foreground">Result</p>
              <div className="relative group">
                <img
                  src={converterResult}
                  alt="Preview"
                  className="max-w-full max-h-48 rounded-md border border-border object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded border border-primary-foreground">
                    Click to copy
                  </span>
                </div>
              </div>
              <textarea
                value={converterResult}
                readOnly
                rows={3}
                className="w-full border border-input bg-background px-3 py-2 rounded-md text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={async (e) => {
                  const ta = e.target as HTMLTextAreaElement;
                  ta.select();
                  try {
                    await navigator.clipboard.writeText(converterResult!);
                  } catch {
                    document.execCommand("copy");
                  }
                }}
              />
              <Button
                variant="primary"
                onClick={useConverterResult}
                disabled={converterLoading}
                className="w-full"
              >
                Use this URL
              </Button>
            </div>
          )}
        </div>
        <footer>
          <Button variant="outline" onClick={() => setConverterOpen(false)} size="sm">
            Cancel
          </Button>
        </footer>
      </Modal>
    </StoreShell>
  );
}
