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

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { carByCode, searchCars, type CarEntry } from "@/lib/car-catalog";
import { vantaApi, formatPrice, type VantaProduct, type VantaCategory, type VantaPromotion } from "@/lib/store/client";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/components/ui/Toaster";
import {
  validateProductForm,
  validateCategoryForm,
  validatePromotionForm,
  type ProductFormInput,
  type CategoryFormInput,
  type PromotionFormInput,
} from "@/lib/store/validation";

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
  stockQuantity: "",
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
  backgroundColor: "var(--color-paper-raised)",
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

  // Force kick: non-admin/owner users are redirected to the store home
  useEffect(() => {
    const checkAdmin = async () => {
      const initData =
        typeof window !== "undefined" && typeof window.Telegram !== "undefined"
          ? window.Telegram.WebApp?.initData ?? ""
          : "";
      const headers: HeadersInit = {};
      if (initData) headers["X-Telegram-Init-Data"] = initData;
      try {
        const r = await fetch("/api/store/admin/is-admin", {
          cache: "no-store",
          headers,
        });
        if (!r.ok) {
          router.push("/store");
          return;
        }
        const data = await r.json();
        if (!data?.isAdmin && !data?.isOwner) router.push("/store");
      } catch {
        router.push("/store");
      }
    };
    checkAdmin();
  }, [router]);

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [inlineEditingId, setInlineEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);
    const toast = useToast();
    // Form validation errors (field-level)
    const [productErrors, setProductErrors] = useState<Record<string, string>>({});
    const [categoryErrors, setCategoryErrors] = useState<Record<string, string>>({});
    const [promotionErrors, setPromotionErrors] = useState<Record<string, string>>({});
  // Category management state
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [categoryForm, setCategoryForm] = useState<CategoryForm>(EMPTY_CATEGORY_FORM);
    const [categorySaving, setCategorySaving] = useState(false);
    const [showCategoryEditSelect, setShowCategoryEditSelect] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  // Promotion management state
  const [showPromotionForm, setShowPromotionForm] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState<number | null>(null);
  const [promotionForm, setPromotionForm] = useState<PromotionForm>(EMPTY_PROMOTION_FORM);
  const [promotionSaving, setPromotionSaving] = useState(false);
  // Car search state for the searchable catalog picker
  const [carQuery, setCarQuery] = useState("");
  const [carOpen, setCarOpen] = useState(false);
  const [pickedCar, setPickedCar] = useState<CarEntry | null>(null);
  const [productConverterFile, setProductConverterFile] = useState<File | null>(null);
  const [productConverterResult, setProductConverterResult] = useState<string | null>(null);
  const [productConverterError, setProductConverterError] = useState<string | null>(null);
  const [promotionConverterFile, setPromotionConverterFile] = useState<File | null>(null);
  const [promotionConverterResult, setPromotionConverterResult] = useState<string | null>(null);
  const [promotionConverterError, setPromotionConverterError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const convertFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setPickedCar(null);
    setEditingId(null);
    setInlineEditingId(null);
    setError(null);
    setMsg(null);
    setProductConverterFile(null);
    setProductConverterResult(null);
    setProductConverterError(null);
  };

    const resetCategoryForm = () => {
      setCategoryForm(EMPTY_CATEGORY_FORM);
      setShowCategoryForm(false);
    };

    const selectProduct = async (p: VantaProduct) => {
      setForm({
        cpm2CarCode: String(p.cpm2CarCode ?? ""),
        imageUrl: "",
        name: p.name,
        description: p.description,
        basePriceCents: String(p.basePriceCents / 100),
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

      // Load existing media for the product so the image isn't lost on edit
      try {
        const { media } = await vantaApi.media(p.id);
        if (media.length > 0) {
          setForm((f) => ({ ...f, imageUrl: media[0].publicUrl }));
        }
      } catch {
        // Media fetch is non-fatal — user can re-upload if needed
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setError(null);
      setProductErrors({});
      // Client-side validation (strict input validation)
      const validated = validateProductForm(form);
      if (!validated.ok) {
        setProductErrors(validated.errors);
        toast.error(
          "Fix the following:",
          Object.values(validated.errors).join(". ")
        );
        setSaving(false);
        return;
      }
      // Catalog guard (mirrors the server-side check): a typed/hand-edited code
      // that isn't a real CPM2 catalog car never reaches the API.
      if (form.cpm2CarCode && !carByCode(Number(form.cpm2CarCode), "cpm2")) {
        toast.error("Invalid car code.", "Pick a car from the catalog search.");
        setSaving(false);
        return;
      }
      const v = validated.data;
      // Stock guard: creating must be >= 1, editing can be 0
      if (!editingId && (!v.stockQuantity || parseInt(v.stockQuantity, 10) < 1)) {
        toast.error("Stock must be at least 1 when creating a product.");
        setSaving(false);
        return;
      }
      try {
        const body = {
          cpm2CarCode: v.cpm2CarCode ? Number(v.cpm2CarCode) : undefined,
          imageUrl: v.imageUrl || undefined,
          name: v.name,
          description: v.description || undefined,
          basePriceCents: Math.round(parseFloat(v.basePriceCents) * 100), // Rands → cents
          currency: v.currency,
          stockQuantity: v.stockQuantity ? parseInt(v.stockQuantity, 10) : 0,
          airSuspension: form.airSuspension,
          unlockedBodykits: form.unlockedBodykits,
          hdLogo: form.hdLogo,
          isFeatured: form.isFeatured,
          isNew: form.isNew,
          isSale: form.isSale,
          isPublished: form.isPublished,
          categoryId: v.categoryId ? Number(v.categoryId) : undefined,
        };
        if (editingId) {
          await vantaApi.updateProduct(editingId, body);
          toast.success("Product updated.");
        } else {
          await vantaApi.createProduct(body);
          // Notify all customers about new vehicle
          await fetch("/api/store/admin/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              title: "New Vehicle Added",
              message: `A new ${body.name} has been added to the catalog. Check it out now!`,
              type: "new_product",
            }),
          });
          toast.success("Product created.");
        }
        resetForm();
        await load();
      } catch (err) {
        toast.error("Save failed.", err instanceof Error ? err.message : undefined);
      } finally {
        setSaving(false);
      }
    };

    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCategorySaving(true);
        setError(null);
        setCategoryErrors({});
        // Client-side validation
        const validated = validateCategoryForm(categoryForm);
        if (!validated.ok) {
          setCategoryErrors(validated.errors);
          toast.error(
            "Fix the following:",
            Object.values(validated.errors).join(". ")
          );
          setCategorySaving(false);
          return;
        }
        const v = validated.data;
        try {
          await vantaApi.createCategory({
            name: v.name,
            slug: v.slug,
            description: v.description,
            sortOrder: parseInt(v.sortOrder, 10),
          });
          setMsg("Category created.");
          resetCategoryForm();
          await load();
        } catch (err) {
          toast.error(
            "Category failed",
            err instanceof Error ? err.message : "Failed to create category."
          );
        } finally {
          setCategorySaving(false);
        }
      };

    // --- Promotion management ---

    const resetPromotionForm = () => {
      setPromotionForm(EMPTY_PROMOTION_FORM);
      setEditingPromotionId(null);
      setShowPromotionForm(false);
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
      setPromotionErrors({});
      // Client-side validation
      const validated = validatePromotionForm(promotionForm);
      if (!validated.ok) {
        setPromotionErrors(validated.errors);
        toast.error(
          "Fix the following:",
          Object.values(validated.errors).join(". ")
        );
        setPromotionSaving(false);
        return;
      }
      const v = validated.data;
      try {
        const body = {
          title: v.title,
          subtitle: v.subtitle || undefined,
          description: v.description || undefined,
          discountPercent: parseInt(v.discountPercent, 10),
          discountCode: v.discountCode || undefined,
          ctaText: v.ctaText,
          ctaLink: v.ctaLink,
          backgroundColor: v.backgroundColor,
          accentColor: v.accentColor,
          imageUrl: v.imageUrl || undefined,
          isActive: v.isActive,
          sortOrder: parseInt(v.sortOrder, 10),
        };
        if (editingPromotionId) {
          await vantaApi.updatePromotion(editingPromotionId, body);
        } else {
          await vantaApi.createPromotion(body);
          // Notify all customers about new promotion
          await fetch("/api/store/admin/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              title: "New Promotion",
              message: `New promotion: ${body.title}. ${body.description || ""}`,
              type: "promotion",
            }),
          });
        }
        setMsg(editingPromotionId ? "Promotion updated." : "Promotion created.");
        resetPromotionForm();
        await load();
      } catch (err) {
        toast.error(
          "Promotion failed",
          err instanceof Error ? err.message : "Failed to save promotion."
        );
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
              <div className="p-4 text-center text-muted-foreground">Loading admin…</div>
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
            <Toast />

                    {/* Top actions — EFT review with clear borders and background */}
                    <div className="mb-6 flex items-center gap-2">
                      <Link href="/store/admin/eft" className="inline-flex items-center gap-2 px-4 py-2 text-[9px] uppercase tracking-[0.15em] whitespace-nowrap cursor-pointer font-bold border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        EFT Review
                      </Link>
                      <Button variant="outline" onClick={() => router.push("/store")} size="sm">
                        Back to store
                      </Button>
                    </div>

                    {/* Category Management */}
                    <section className="admin-section panel rounded-xl border border-border p-4 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="admin-section-title">Categories</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCategoryForm(!showCategoryForm)}
                        >
                          {showCategoryForm ? "Hide" : "Add Category"}
                        </Button>
                      </div>
          {showCategoryForm && (
            <form onSubmit={handleCategorySubmit} className="flex flex-col gap-3 mb-4">
              {/* Errors now shown as floating toasts */}
              <Field label="Name" error={categoryErrors.name}>
                <TextInput
                  value={categoryForm.name}
                  onChange={(e) => handleCategoryChange("name", e.target.value)}
                  placeholder="e.g. Sports Cars"
                />
              </Field>
              <Field label="URL slug" error={categoryErrors.slug} hint="Auto-generated from category name">
                <TextInput
                  value={categoryForm.slug}
                  onChange={(e) => handleCategoryChange("slug", e.target.value)}
                  placeholder="sports-cars"
                />
              </Field>
              <Field label="Description" error={categoryErrors.description} hint="Optional description">
                            <textarea
                              value={categoryForm.description}
                              onChange={(e) => handleCategoryChange("description", e.target.value)}
                              placeholder="Optional description"
                              className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground min-h-[60px] resize-y"
                            />
                          </Field>
              <Field label="Sort Order" error={categoryErrors.sortOrder} hint="Lower numbers appear first">
                <input
                  type="number"
                  value={categoryForm.sortOrder}
                  onChange={(e) => handleCategoryChange("sortOrder", e.target.value)}
                  className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
                />
              </Field>
              <div className="flex gap-2">
                <Button
                              variant="primary"
                              type="submit"
                              disabled={categorySaving}
                              className="w-full sm:w-auto"
                            >
                              {categorySaving ? "Creating…" : "Create Category"}
                            </Button>
                            <Button variant="outline" type="button" onClick={resetCategoryForm} disabled={categorySaving} className="w-full sm:w-auto">
                              Cancel
                            </Button>
              </div>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            {categories.length === 0 ? (
              <span className="text-xs text-muted-foreground">No categories yet. Click "Add Category" to create one.</span>
            ) : (
              <>
                {categories.map((cat) => (
                  <span
                    key={cat.id}
                    className="text-xs px-2 py-1 rounded-full border border-border bg-background text-foreground"
                  >
                    {cat.name} ({cat.slug})
                  </span>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Single edit button: open select to pick which category to edit
                    setEditingCategoryId(null);
                    setShowCategoryEditSelect(true);
                  }}
                >
                  Edit Category
                </Button>
              </>
            )}
            {showCategoryEditSelect && categories.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={editingCategoryId ?? ""}
                  onChange={(e) => setEditingCategoryId(Number(e.target.value))}
                  className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
                >
                  <option value="">Pick a category to edit…</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (!editingCategoryId) return;
                    const cat = categories.find((c) => c.id === editingCategoryId);
                    if (!cat) return;
                    setCategoryForm({
                      name: cat.name,
                      slug: cat.slug,
                      description: cat.description,
                      sortOrder: String(cat.sortOrder),
                    });
                    setShowCategoryForm(true);
                    setShowCategoryEditSelect(false);
                    setEditingCategoryId(null);
                  }}
                  disabled={!editingCategoryId}
                >
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCategoryEditSelect(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </section>

                {/* Promotions Management */}
                <section className="admin-section panel rounded-xl border border-border p-4 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="admin-section-title">Promotions</h3>
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
                      "Add Promotion"
                    </Button>
                  </div>

              {showPromotionForm && (
                <form onSubmit={handlePromotionSubmit} className="flex flex-col gap-3 mb-4">
                  {/* Errors now shown as floating toasts */}
                  <Field label="Title" error={promotionErrors.title}>
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
                  <Field label="Description" error={promotionErrors.description}>
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
                    <div className="relative group cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (!file) return;
                          setPromotionConverterFile(file);
                          setPromotionConverterError(null);
                          try {
                            const dataUrl = await convertFileToDataUrl(file);
                            setPromotionConverterResult(dataUrl);
                            // Auto-convert to URL — no extra click needed
                            setPromotionForm((f) => ({ ...f, imageUrl: dataUrl }));
                            setPromotionConverterFile(null);
                            setPromotionConverterResult(null);
                          } catch {
                            setPromotionConverterError("Failed to read image file.");
                          }
                          }}
                          />
                          <div
                          onClick={() => fileInputRef.current?.click()}
                          className={`flex items-center gap-2 w-full border border-input rounded-md bg-background px-3 py-2 text-sm ${promotionConverterFile ? "border-emerald-500 text-emerald-500 bg-emerald-50" : "border-border text-foreground hover:border-primary transition-colors"} cursor-pointer`}
                          >
                          {promotionConverterFile ? (
                          <>
                            <span className="text-xs font-bold text-emerald-500">✓</span>
                            {promotionConverterFile.name}
                          </>
                          ) : (
                          "Choose image"
                          )}
                          </div>
                          </div>
                          {promotionConverterError && <p className="text-xs text-destructive mt-1">{promotionConverterError}</p>}
                          {promotionConverterResult && (
                          <div className="mt-3 border border-input rounded-md p-3 bg-background">
                          <img src={promotionConverterResult} alt="Preview" className="max-w-full max-h-48 rounded-md border border-border object-cover" />
                          <p className="text-[10px] text-ink-soft mt-2">Image preview — URL auto-set</p>
                          </div>
                          )}
                  </Field>
                  <Field label="Active">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={promotionForm.isActive}
                        onChange={(e) => setPromotionForm((f) => ({ ...f, isActive: e.target.checked }))}
                        className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <span className="text-base font-bold text-foreground">Show on home page</span>
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
                  <div className="flex flex-col gap-2">
                                      <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={promotionSaving}
                                        className="w-full sm:w-auto"
                                      >
                                        {promotionSaving ? "Saving…" : editingPromotionId ? "Update Promotion" : "Create Promotion"}
                                      </Button>
                                      <Button variant="outline" type="button" onClick={resetPromotionForm} disabled={promotionSaving} className="w-full sm:w-auto">
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
                      className={`promotion-card flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border`}
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
                          {p.imageUrl && <span className="text-[10px] text-ink-faint">image</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowPromotionForm(true);
                            selectPromotion(p);
                          }}
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
                    <section className="admin-section panel rounded-xl border border-border p-6 mb-8">
                      <h3 className="admin-section-title mb-4">
                        {editingId ? "Edit product" : "Add product"}
                      </h3>
                      <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Errors now shown as floating toasts */}
          <Field label="Image" error={productErrors.imageUrl}>
            <div className="relative group cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;
                  setProductConverterError(null);
                  try {
                    // Upload to server and get a real public URL
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch("/api/store/admin/upload-image", {
                      method: "POST",
                      body: formData,
                    });
                    if (!res.ok) {
                      const errBody = await res.json().catch(() => ({}));
                      throw new Error(errBody.error?.message || "Upload failed");
                    }
                    const { url } = (await res.json()) as { url: string };
                    // Set the real URL into the form
                    setForm((f) => ({ ...f, imageUrl: url }));
                    // Keep preview + filename visible
                    setProductConverterFile(file);
                    setProductConverterResult(url);
                  } catch {
                    setProductConverterError("Failed to upload image.");
                  }
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 w-full border border-input rounded-md bg-background px-3 py-2 text-sm ${productConverterFile ? "border-emerald-500 text-emerald-500 bg-emerald-50" : "border-border text-foreground hover:border-primary transition-colors"} cursor-pointer`}
              >
                {productConverterFile ? (
                  <>
                    <span className="text-xs font-bold">✓</span>
                    {productConverterFile.name}
                  </>
                ) : (
                  "Choose image"
                )}
              </div>
            </div>
            {productConverterError && <p className="text-xs text-destructive mt-1">{productConverterError}</p>}
            {productConverterResult && (
              <div className="mt-3 border border-input rounded-md p-3 bg-background">
                <img src={productConverterResult} alt="Preview" className="max-w-full max-h-48 rounded-md border border-border object-cover" />
                <p className="text-[10px] text-ink-soft mt-2">Image preview — URL auto-set</p>
              </div>
            )}
          </Field>
          <Field
            label="Car (CPM2 catalog)"
            error={productErrors.cpm2CarCode}
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
                    Clear
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
                    className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-border rounded-md bg-background shadow-lg"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {carMatches.map((car) => (
                      <button
                        key={car.code}
                        type="button"
                        onClick={() => pickCar(car)}
                        className="block w-full text-left px-3 py-2 text-sm bg-background/95 hover:bg-background hover:border-primary border-b border-border last:border-b-0"
                      >
                        <span className="text-foreground">{car.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="absolute z-20 mt-1 w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-muted-foreground">
                    No car in the CPM2 catalog matches "{carQuery}".
                  </div>
                ))}
              </div>
            )}
          </Field>
          <Field label="Name" error={productErrors.name} hint='Auto-filled from the catalog pick above - edit for custom design names (e.g. "GOLF GTI III - Midnight Chrome")'>
            <TextInput
              id="name"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Toyota Supra MK4"
            />
          </Field>
          <Field label="Price (ZAR)" error={productErrors.basePriceCents} hint="Enter price in Rands, e.g. 60.00">
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
            error={productErrors.stockQuantity}
            hint="How many available - set to 0 to mark out of stock"
          >
            <input
              id="stock"
              type="number"
              min={editingId === null ? 1 : 0}
              value={form.stockQuantity}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  setForm((f) => ({ ...f, stockQuantity: v }));
                  return;
                }
                setForm((f) => ({ ...f, stockQuantity: v }));
              }}
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
            <label className="custom-checkbox">
              <input
                type="checkbox"
                id="air-suspension"
                checked={form.airSuspension}
                onChange={(e) => handleChange("airSuspension", e.target.checked)}
              />
              <div className="checkmark"></div>
              <span className="text-base font-bold text-foreground">Include air suspension</span>
            </label>
          </Field>
          <Field label="Unlocked bodykits" hint="This design unlocks bodykits">
            <label className="custom-checkbox">
              <input
                type="checkbox"
                id="unlocked-bodykits"
                checked={form.unlockedBodykits}
                onChange={(e) => handleChange("unlockedBodykits", e.target.checked)}
              />
              <div className="checkmark"></div>
              <span className="text-base font-bold text-foreground">Include unlocked bodykits</span>
            </label>
          </Field>
          <Field label="HD Logo" hint="This design includes a high-definition logo">
            <label className="custom-checkbox">
              <input
                type="checkbox"
                id="hd-logo"
                checked={form.hdLogo}
                onChange={(e) => handleChange("hdLogo", e.target.checked)}
              />
              <div className="checkmark"></div>
              <span className="text-base font-bold text-foreground">Include HD logo</span>
            </label>
          </Field>
          <Field label="Featured">
            <label className="custom-checkbox">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => handleChange("isFeatured", e.target.checked)}
              />
              <div className="checkmark"></div>
              <span className="text-base font-bold text-foreground">Featured on home page</span>
            </label>
          </Field>
          <Field label="New Arrival">
            <label className="custom-checkbox">
              <input
                type="checkbox"
                checked={form.isNew}
                onChange={(e) => handleChange("isNew", e.target.checked)}
              />
              <div className="checkmark"></div>
              <span className="text-base font-bold text-foreground">Show &quot;New&quot; badge</span>
            </label>
          </Field>
          <Field label="Sale">
            <label className="custom-checkbox">
              <input
                type="checkbox"
                checked={form.isSale}
                onChange={(e) => handleChange("isSale", e.target.checked)}
              />
              <div className="checkmark"></div>
              <span className="text-base font-bold text-foreground">Show &quot;Sale&quot; badge</span>
            </label>
          </Field>
          <Field label="Published">
            <label className="custom-checkbox">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => handleChange("isPublished", e.target.checked)}
              />
              <div className="checkmark"></div>
              <span className="text-base font-bold text-foreground">Visible to customers</span>
            </label>
          </Field>
          <div className="flex flex-col gap-2">
                                <Button
                                  type="submit"
                                  variant="primary"
                                  disabled={saving}
                                  className="w-full sm:w-auto"
                                >
                                  {saving ? "Saving…" : editingId ? "Update product" : "Create product"}
                                </Button>
                                <Button variant="outline" type="button" onClick={resetForm} disabled={saving} className="w-full sm:w-auto">
                                  Reset
                                </Button>
                              </div>
                  </form>
                </section>
                            )}

                            {/* Product list */}
                            <section className="admin-section panel rounded-xl border border-border p-4">
                              <div className="flex items-baseline justify-between mb-4">
                                <h3 className="admin-section-title">Catalogue</h3>
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
                              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="flex flex-col gap-3">
                      <Field label="Image" error={productErrors.imageUrl}>
                        <div className="relative group cursor-pointer">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={async (e) => {
                              const file = e.target.files?.[0] ?? null;
                              if (!file) return;
                              setProductConverterFile(file);
                              setProductConverterError(null);
                              try {
                                const dataUrl = await convertFileToDataUrl(file);
                                setProductConverterResult(dataUrl);
                                setForm((f) => ({ ...f, imageUrl: dataUrl }));
                                setProductConverterFile(null);
                                setProductConverterResult(null);
                              } catch {
                                setProductConverterError("Failed to read image file.");
                              }
                            }}
                          />
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex items-center gap-2 w-full border border-input rounded-md bg-background px-3 py-2 text-sm ${productConverterFile ? "border-emerald-500 text-emerald-500 bg-emerald-50" : "border-border text-foreground hover:border-primary transition-colors"} cursor-pointer`}
                          >
                            {productConverterFile ? (
                              <>
                                <span className="text-xs font-bold">✓</span>
                                {productConverterFile.name}
                              </>
                            ) : (
                              "Choose image"
                            )}
                          </div>
                        </div>
                        {productConverterError && <p className="text-xs text-destructive mt-1">{productConverterError}</p>}
                        {productConverterResult && (
                          <div className="mt-3 border border-input rounded-md p-3 bg-background">
                            <img src={productConverterResult} alt="Preview" className="max-w-full max-h-48 rounded-md border border-border object-cover" />
                            <p className="text-[10px] text-ink-soft mt-2">Image preview — URL auto-set</p>
                          </div>
                        )}
                      </Field>
                      <Field
                        label="Car (CPM2 catalog)"
                        error={productErrors.cpm2CarCode}
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
                                Clear
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
                                className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-border rounded-md bg-background shadow-lg"
                                onMouseDown={(e) => e.preventDefault()}
                              >
                                {carMatches.map((car) => (
                                  <button
                                    key={car.code}
                                    type="button"
                                    onClick={() => pickCar(car)}
                                    className="block w-full text-left px-3 py-2 text-sm bg-background/95 hover:bg-background hover:border-primary border-b border-border last:border-b-0"
                                  >
                                    <span className="text-foreground">{car.name}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="absolute z-20 mt-1 w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-muted-foreground">
                                No car in the CPM2 catalog matches "{carQuery}".
                              </div>
                            ))}
                          </div>
                        )}
                      </Field>
                      <Field label="Name" error={productErrors.name} hint='Auto-filled from the catalog pick above - edit for custom design names (e.g. "GOLF GTI III - Midnight Chrome")'>
                        <TextInput
                          id="name"
                          value={form.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                          placeholder="Toyota Supra MK4"
                        />
                      </Field>
                      <Field label="Price (ZAR)" error={productErrors.basePriceCents}>
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
                        error={productErrors.stockQuantity}
                        hint={editingId === null ? "Locked at 1 for new products" : "How many available - set to 0 to mark out of stock"}
                      >
                        <input
                          type="number"
                          min={editingId === null ? 1 : 0}
                          value={editingId === null ? "1" : form.stockQuantity}
                          onChange={editingId === null ? undefined : (e) => handleChange("stockQuantity", e.target.value)}
                          readOnly={editingId === null}
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
                        <label className="custom-checkbox">
                          <input
                            type="checkbox"
                            checked={form.airSuspension}
                            onChange={(e) => handleChange("airSuspension", e.target.checked)}
                          />
                          <div className="checkmark"></div>
                          <span className="text-base font-bold text-foreground">Include air suspension</span>
                        </label>
                      </Field>
                      <Field label="Unlocked bodykits">
                        <label className="custom-checkbox">
                          <input
                            type="checkbox"
                            checked={form.unlockedBodykits}
                            onChange={(e) => handleChange("unlockedBodykits", e.target.checked)}
                          />
                          <div className="checkmark"></div>
                          <span className="text-base font-bold text-foreground">Include unlocked bodykits</span>
                        </label>
                      </Field>
                      <Field label="HD Logo">
                        <label className="custom-checkbox">
                          <input
                            type="checkbox"
                            checked={form.hdLogo}
                            onChange={(e) => handleChange("hdLogo", e.target.checked)}
                          />
                          <div className="checkmark"></div>
                          <span className="text-base font-bold text-foreground">Include HD logo</span>
                        </label>
                      </Field>
                      <Field label="New Arrival">
                        <label className="custom-checkbox">
                          <input
                            type="checkbox"
                            checked={form.isNew}
                            onChange={(e) => handleChange("isNew", e.target.checked)}
                          />
                          <div className="checkmark"></div>
                          <span className="text-base font-bold text-foreground">Show &quot;New&quot; badge</span>
                        </label>
                      </Field>
                      <Field label="Sale">
                        <label className="custom-checkbox">
                          <input
                            type="checkbox"
                            checked={form.isSale}
                            onChange={(e) => handleChange("isSale", e.target.checked)}
                          />
                          <div className="checkmark"></div>
                          <span className="text-base font-bold text-foreground">Show &quot;Sale&quot; badge</span>
                        </label>
                      </Field>
                      <Field label="Published">
                        <label className="custom-checkbox">
                          <input
                            type="checkbox"
                            checked={form.isPublished}
                            onChange={(e) => handleChange("isPublished", e.target.checked)}
                          />
                          <div className="checkmark"></div>
                          <span className="text-base font-bold text-foreground">Visible to customers</span>
                        </label>
                      </Field>
                      <div className="flex flex-col gap-2">
                                              <Button type="submit" variant="primary" disabled={saving} className="w-full sm:w-auto">
                                                {saving ? "Saving…" : "Update product"}
                                              </Button>
                                              <Button variant="destructive" type="button" size="sm" onClick={async () => {
                                                if (!window.confirm(`Delete "${p.name}"? This will unpublish and mark unavailable.`)) return;
                                                setError(null);
                                                const scrollY = window.scrollY;
                                                try {
                                                  await vantaApi.deleteProduct(p.id);
                                                  setMsg("Product deleted (unpublished & marked unavailable).");
                                                  await load();
                                                  window.scrollTo(0, scrollY);
                                                  setInlineEditingId(null);
                                                } catch (err) {
                                                  setError(err instanceof Error ? err.message : "Failed to delete product.");
                                                }
                                              }} className="w-full sm:w-auto">
                                                Delete
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

    </StoreShell>
  );
}
