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
import { carByCode, type CarEntry } from "@/lib/car-catalog";
import { vantaApi, formatPrice, type VantaProduct, type VantaCategory, type VantaPromotion } from "@/lib/store/client";
import { clientInitData } from "@/lib/client-initdata";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/components/ui/Toaster";
import { Uploader } from "@/components/ui/Uploader";
import { AdminSkeleton } from "@/components/skeleton";
import { PlusCircleIcon, MinusCircleIcon } from "@/components/ui/icons";
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
  stockQuantity: "1",
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
  imageUrl: string;
};

const EMPTY_CATEGORY_FORM: CategoryForm = {
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
  imageUrl: "",
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
      const initData = clientInitData();
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
  const [cars, setCars] = useState<CarEntry[]>([]);
  const [productConverterFile, setProductConverterFile] = useState<File | null>(null);
  const [productConverterResult, setProductConverterResult] = useState<string | null>(null);
  const [productConverterError, setProductConverterError] = useState<string | null>(null);
  const [productConverterUploading, setProductConverterUploading] = useState(false);
  const [promotionConverterFile, setPromotionConverterFile] = useState<File | null>(null);
  const [promotionConverterResult, setPromotionConverterResult] = useState<string | null>(null);
  const [promotionConverterError, setPromotionConverterError] = useState<string | null>(null);
  const [categoryConverterFile, setCategoryConverterFile] = useState<File | null>(null);
  const [categoryConverterResult, setCategoryConverterResult] = useState<string | null>(null);
  const [categoryConverterError, setCategoryConverterError] = useState<string | null>(null);
  const [categoryConverterUploading, setCategoryConverterUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promoFileInputRef = useRef<HTMLInputElement>(null);
  const categoryFileInputRef = useRef<HTMLInputElement>(null);
  // Toggle for the add/edit product form (behind a button, not always open)
  const [showProductForm, setShowProductForm] = useState(false);


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes, promoRes, carsRes] = await Promise.all([
        vantaApi.products({}),
        vantaApi.categories(),
        vantaApi.promotions(),
        fetch("/api/store/cars").then((r) => r.json()),
      ]);
      setProducts(pRes.products);
      setCategories(cRes.categories);
      setPromotions(Array.isArray(promoRes.promotions) ? promoRes.promotions : []);
      if (carsRes && Array.isArray(carsRes.cars)) {
        setCars(carsRes.cars);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't load products, categories, or promotions."
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

  /** +/- stepper for the stock field. Creating clamps at 1; editing allows 0. */
  const stepStock = (dir: number) => {
    const min = editingId === null ? 1 : 0;
    setForm((f) => {
      const cur = parseInt(f.stockQuantity, 10);
      const base = Number.isFinite(cur) ? cur : editingId === null ? 1 : 0;
      return { ...f, stockQuantity: String(Math.max(min, base + dir)) };
    });
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

  // Downscale + re-encode large images (phone camera photos are 10MB+) to a
  // small JPEG before upload. Server request bodies are capped (10MB local,
  // ~4.5MB on Vercel serverless), so raw camera files get rejected with a
  // generic 500 — compressing here avoids that entirely.
  const compressImageForUpload = async (file: File, maxDim = 1600, quality = 0.85): Promise<File> => {
    if (typeof createImageBitmap !== "function") return file;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob || blob.size >= file.size) return file;
      const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return new File([blob], name, { type: "image/jpeg" });
    } catch {
      // Undecodable format (e.g. HEIC outside Safari) — send the original
      return file;
    }
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

    const openProductForm = () => {
    resetForm();
    setShowProductForm(true);
  };

  const resetCategoryForm = () => {
      setCategoryForm(EMPTY_CATEGORY_FORM);
      setShowCategoryForm(false);
      setEditingCategoryId(null);
      setCategoryConverterFile(null);
      setCategoryConverterResult(null);
      setCategoryConverterError(null);
      setCategoryConverterUploading(false);
    };

    const selectProduct = async (p: VantaProduct) => {
      setForm({
        cpm2CarCode: String(p.cpm2CarCode ?? ""),
        imageUrl: p.imageUrl ?? "",
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
              imageUrl: body.imageUrl ?? undefined,
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
        let imageUrl = categoryForm.imageUrl;
        // Upload image if a new file was selected.
        if (categoryConverterFile) {
          try {
            setCategoryConverterUploading(true);
            const uploadFile = await compressImageForUpload(categoryConverterFile);
            const formData = new FormData();
            formData.append("file", uploadFile);
            const res = await fetch("/api/store/admin/upload-image", {
              method: "POST",
              body: formData,
            });
            if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              throw new Error(errBody.error?.message || "Upload failed");
            }
            const { url } = (await res.json()) as { url: string };
            imageUrl = url;
          } catch (err) {
            setCategoryConverterError(err instanceof Error ? err.message : "Failed to upload image.");
            setCategorySaving(false);
            setCategoryConverterUploading(false);
            return;
          } finally {
            setCategoryConverterUploading(false);
          }
        }
        try {
          if (editingCategoryId) {
            await vantaApi.updateCategory(editingCategoryId, {
              name: v.name,
              slug: v.slug,
              description: v.description,
              sortOrder: parseInt(v.sortOrder, 10),
              imageUrl: imageUrl || undefined,
            });
            setMsg("Category updated.");
          } else {
            await vantaApi.createCategory({
              name: v.name,
              slug: v.slug,
              description: v.description,
              sortOrder: parseInt(v.sortOrder, 10),
              imageUrl: imageUrl || undefined,
            });
            setMsg("Category created.");
          }
          resetCategoryForm();
          setEditingCategoryId(null);
          await load();
        } catch (err) {
          toast.error(
            "Category failed",
            err instanceof Error ? err.message : "Failed to save category."
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
              imageUrl: body.imageUrl ?? undefined,
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
              <PageHeading folio="AD" title="Admin - Product Manager" />
              <AdminSkeleton />
            </StoreShell>
          );
        }

    // Car codes are set-once: locked for editing when the product already has one.
    const carLocked = editingId !== null && form.cpm2CarCode !== "";

    // Searchable catalog matches (name-only, no codes visible) — from Fleet Ledger DB
    const carMatches = cars.filter(
      (c) => !carQuery || c.name.toLowerCase().includes(carQuery.toLowerCase())
    ).slice(0, 30);

    return (
          <StoreShell>
            <PageHeading folio="AD" title="Admin - Product Manager" />
            <Toast />

                    {/* Top actions — EFT review with clear borders and background */}
                    <div className="mb-6 flex items-center gap-2">
                      <Link href="/store/admin/eft" className="inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.1em] whitespace-nowrap cursor-pointer font-bold border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        EFT Review
                      </Link>
                    </div>

                    {/* Category Management */}
                    <section className="admin-section panel rounded-xl border border-border p-4 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="admin-section-title">Categories</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (showCategoryForm) {
                              resetCategoryForm();
                              setEditingCategoryId(null);
                            } else {
                              // Fresh "Add" — clear any edit picked from a row
                              resetCategoryForm();
                              setEditingCategoryId(null);
                              setShowCategoryForm(true);
                            }
                          }}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <PlusCircleIcon className="w-4 h-4" />
                            {showCategoryForm ? "Hide" : "Add Category"}
                          </span>
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
              <Field label="Category image (optional)">
                <Uploader
                  inputRef={categoryFileInputRef}
                  compact
                  accept="image/*"
                  busy={categoryConverterUploading ? "Converting image…" : null}
                  fileName={categoryConverterFile?.name ?? (categoryForm.imageUrl ? "Image attached" : null)}
                  onFiles={async (files) => {
                    const file = files?.[0] ?? null;
                    if (!file) return;
                    setCategoryConverterFile(file);
                    setCategoryConverterError(null);
                    try {
                      const dataUrl = await convertFileToDataUrl(await compressImageForUpload(file));
                      setCategoryConverterResult(dataUrl);
                      setCategoryForm((f) => ({ ...f, imageUrl: dataUrl }));
                      setCategoryConverterFile(null);
                      setCategoryConverterResult(null);
                    } catch {
                      setCategoryConverterError("Failed to read image file.");
                    }
                  }}
                />
                {categoryForm.imageUrl && !categoryConverterFile && (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => setCategoryForm((f) => ({ ...f, imageUrl: "" }))}
                      className="text-[10px] text-destructive underline underline-offset-2 cursor-pointer"
                    >
                      remove image
                    </button>
                  </div>
                )}
                {categoryConverterError && <p className="text-xs text-destructive mt-1">{categoryConverterError}</p>}
                {categoryConverterResult && (
                  <div className="mt-3 border border-input rounded-md p-3 bg-background">
                    <img src={categoryConverterResult} alt="Preview" className="max-w-full max-h-32 rounded-md border border-border object-cover" />
                    <p className="text-[10px] text-ink-soft mt-2">Live preview from URL</p>
                  </div>
                )}
              </Field>
              <div className="flex gap-2">
                <Button
                              variant="primary"
                              type="submit"
                              disabled={categorySaving}
                              className="w-full sm:w-auto"
                            >
                              {categorySaving ? "Saving…" : editingCategoryId ? "Update Category" : "Create Category"}
                            </Button>
                            <Button variant="outline" type="button" onClick={resetCategoryForm} disabled={categorySaving} className="w-full sm:w-auto">
                              Cancel
                            </Button>
              </div>
            </form>
          )}
          {/* Category rows — every category listed with its own Edit (item 13) */}
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">No categories yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{cat.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      /{cat.slug} · sort {cat.sortOrder}
                      {cat.description ? ` · ${cat.description}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setCategoryForm({
                        name: cat.name,
                        slug: cat.slug,
                        description: cat.description,
                        sortOrder: String(cat.sortOrder),
                        imageUrl: cat.imageUrl,
                      });
                      // Keep editingCategoryId set — handleCategorySubmit
                      // branches on it to update instead of create.
                      setEditingCategoryId(cat.id);
                      setShowCategoryForm(true);
                      setMsg(null);
                      setError(null);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
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
                      <span className="inline-flex items-center gap-1.5">
                        <PlusCircleIcon className="w-4 h-4" />
                        Add Promotion
                      </span>
                    </Button>
                  </div>

                  {/* Promotions are edited from each card's own Edit button —
                      no picker dropdown (item 13). */}

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
                    <Uploader
                      inputRef={promoFileInputRef}
                      compact
                      accept="image/*"
                      fileName={promotionConverterFile?.name ?? (promotionForm.imageUrl ? "Image attached" : null)}
                      onFiles={async (files) => {
                          const file = files?.[0] ?? null;
                          if (!file) return;
                          setPromotionConverterFile(file);
                          setPromotionConverterError(null);
                          try {
                            const dataUrl = await convertFileToDataUrl(await compressImageForUpload(file));
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
                    {promotionForm.imageUrl && (
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => setPromotionForm((f) => ({ ...f, imageUrl: "" }))}
                          className="text-[10px] text-destructive underline underline-offset-2 cursor-pointer"
                        >
                          remove image
                        </button>
                      </div>
                    )}
                          {promotionConverterError && <p className="text-xs text-destructive mt-1">{promotionConverterError}</p>}
                          {promotionConverterResult && (
                          <div
                            className="relative mt-3 overflow-hidden rounded-md border border-border h-32"
                            style={{ backgroundColor: promotionForm.backgroundColor || "var(--color-paper-raised)" }}
                          >
                            {promotionForm.imageUrl && (
                              <>
                                <img
                                  src={promotionForm.imageUrl}
                                  alt="Banner preview"
                                  className="absolute inset-y-0 right-0 h-full w-[55%] object-cover"
                                />
                                <div
                                  className="absolute inset-y-0 right-0 w-[55%] pointer-events-none"
                                  style={{
                                    background: `linear-gradient(90deg, ${promotionForm.backgroundColor || "var(--color-paper-raised)"} 0%, transparent 100%)`,
                                  }}
                                />
                              </>
                            )}
                            <div className="relative z-10 p-3">
                              <p
                                className="text-[10px] uppercase tracking-[0.2em]"
                                style={{ color: promotionForm.accentColor || "#d4af4f" }}
                              >
                                {promotionForm.subtitle || "Special offer"}
                              </p>
                              <p className="font-serif font-bold text-lg">
                                {promotionForm.title || "Title"}
                              </p>
                            </div>
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

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 auto-rows-fr">
                {promotions.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No promotions yet. Click Add Promotion to create one.</span>
                ) : (
                  promotions.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col h-full rounded-[22px] border border-border overflow-hidden bg-raised shadow-sm"
                    >
                      {/* Miniature of the live home promotion card */}
                      <div
                        className="promotion-card relative overflow-hidden p-5 flex-1 min-h-[160px]"
                        style={{
                          backgroundColor: p.backgroundColor || "var(--color-paper-raised)",
                          color: p.accentColor ? "var(--color-paper-sunken)" : undefined,
                        }}
                      >
                        {p.imageUrl && (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="absolute inset-y-0 right-0 h-full w-[55%] object-cover pointer-events-none"
                            />
                            <div className="promo-metal-fade absolute inset-0 pointer-events-none" />
                          </>
                        )}
                        <div className="relative z-10">
                          <span
                            className="text-[9px] uppercase tracking-[0.2em]"
                            style={{ color: p.accentColor || "#d4af4f" }}
                          >
                            {p.subtitle || "Special offer"}
                          </span>
                          <h4
                            className="font-serif font-bold text-[18px] leading-none mt-0.5"
                            style={{ color: p.accentColor || undefined }}
                          >
                            {p.title}
                          </h4>
                          {p.description && (
                            <p className="text-[10px] text-ink mt-1">{p.description}</p>
                          )}
                          {(p.discountPercent > 0 || p.discountCode) && (
                            <p
                              className="text-[10px] mt-1"
                              style={{ color: p.accentColor || undefined }}
                            >
                              {p.discountCode ? (
                                <>
                                  Code <b className="text-[10px] font-bold tracking-[0.12em]">{p.discountCode}</b>
                                  {p.discountPercent > 0 ? ` · ${p.discountPercent}% off` : ""}
                                </>
                              ) : (
                                `${p.discountPercent}% off`
                              )}
                            </p>
                          )}
                          <span
                            className="inline-block mt-2 text-[10px] font-bold tracking-wider border rounded-full px-3 py-1"
                            style={{
                              borderColor: p.accentColor || undefined,
                              color: p.accentColor || undefined,
                            }}
                          >
                            {p.ctaText || "Shop now"} ▸
                          </span>
                        </div>
                      </div>
                      {/* Meta + actions row */}
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border bg-background">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground">#{p.id}</span>
                          {p.isActive ? (
                            <span className="text-[10px] text-primary font-bold">ACTIVE</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-bold">INACTIVE</span>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
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
                    </div>
                  ))
                )}
              </div>
            </section>

      {/* Create / Edit form - always shown when toggled */}
                        {showProductForm && (
                    <section className="admin-section panel rounded-xl border border-border p-6 mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="admin-section-title">
                          {editingId ? "Edit product" : "Add product"}
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowProductForm(false)}
                        >
                          Hide
                        </Button>
                      </div>
                      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Errors now shown as floating toasts */}
          <Field label="Image" error={productErrors.imageUrl}>
            <Uploader
              inputRef={fileInputRef}
              compact
              accept="image/*"
              busy={productConverterUploading ? "Converting image…" : null}
              fileName={productConverterFile?.name ?? (form.imageUrl ? "Image attached" : null)}
              onFiles={async (files) => {
                  const file = files?.[0] ?? null;
                  if (!file) return;
                  setProductConverterError(null);
                  setProductConverterResult(null);
                  setProductConverterFile(null);
                  setProductConverterUploading(true);
                  try {
                    // Upload to server and get a real public URL
                    const uploadFile = await compressImageForUpload(file);
                    const formData = new FormData();
                    formData.append("file", uploadFile);
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
                  } catch (err) {
                    // Server upload failed — fall back to local data URL
                    const msg = err instanceof Error ? err.message : "Upload failed";
                    try {
                      const dataUrl = await convertFileToDataUrl(file);
                      setForm((f) => ({ ...f, imageUrl: dataUrl }));
                      setProductConverterFile(file);
                      setProductConverterResult(dataUrl);
                    } catch {
                      setProductConverterError(`Failed to upload image: ${msg}`);
                    }
                  } finally {
                    setProductConverterUploading(false);
                  }
                }}
            />
            {form.imageUrl && !productConverterFile && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                  className="text-[10px] text-destructive underline underline-offset-2 cursor-pointer"
                >
                  remove image
                </button>
              </div>
            )}
            {productConverterError && <p className="text-xs text-destructive mt-1">{productConverterError}</p>}
            {productConverterResult && (
              <div className="mt-3 border border-input rounded-md p-3 bg-background">
                <img src={productConverterResult} alt="Preview" className="max-w-full max-h-48 rounded-md border border-border object-cover" />
                <p className="text-[10px] text-ink-soft mt-2">Live preview from URL</p>
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
                    No car in the CPM2 catalog matches {carQuery}.
                  </div>
                ))}
              </div>
            )}
          </Field>
          <Field label="Name" htmlFor="name" error={productErrors.name} hint="Auto-filled from the catalog pick">
            <TextInput
              id="name"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Vehicle or design name"
            />
          </Field>
          <Field label="Price (ZAR)" htmlFor="price" error={productErrors.basePriceCents}>
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
            htmlFor="stock"
            error={productErrors.stockQuantity}
            hint={editingId === null ? undefined : "0 = out of stock"}
          >
            <div className="flex items-stretch gap-1.5">
              <button
                type="button"
                onClick={() => stepStock(-1)}
                disabled={saving}
                aria-label="Decrease stock"
                className="flex w-[42px] shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                <MinusCircleIcon className="w-5 h-5" />
              </button>
              <input
                id="stock"
                type="number"
                inputMode="numeric"
                min={editingId === null ? 1 : 0}
                value={form.stockQuantity}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setForm((f) => ({ ...f, stockQuantity: v }));
                    return;
                  }
                  const n = parseInt(v, 10);
                  if (!Number.isFinite(n)) return;
                  // Creating: never below 1. Editing: 0 allowed = out of stock.
                  const min = editingId === null ? 1 : 0;
                  setForm((f) => ({ ...f, stockQuantity: String(Math.max(min, n)) }));
                }}
                className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground text-center"
              />
              <button
                type="button"
                onClick={() => stepStock(1)}
                disabled={saving}
                aria-label="Increase stock"
                className="flex w-[42px] shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                <PlusCircleIcon className="w-5 h-5" />
              </button>
            </div>
          </Field>
          <Field label="Category" htmlFor="category" hint={categories.length === 0 ? "No categories yet" : undefined}>
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
          <Field label="Air suspension install">
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
          <Field label="Unlocked bodykits">
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
          <Field label="HD Logo">
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
              <span className="text-base font-bold text-foreground">New badge</span>
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
              <span className="text-base font-bold text-foreground">Sale badge</span>
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
                                    onClick={openProductForm}
                                  >
                                    <span className="inline-flex items-center gap-1.5">
                                      <PlusCircleIcon className="w-4 h-4" />
                                      Add product
                                    </span>
                                  </Button>
                                </div>
                              </div>
                  {products.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                      <p className="text-muted-foreground">No products yet.</p>
                    </div>
                  ) : (
                    /* Every product listed as its own row with an Edit button —
                       no picker dropdown (item 13). */
                    <div className="flex flex-col gap-2">
                      {products.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">
                              {p.name}
                              {!p.isPublished && (
                                <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Hidden</span>
                              )}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              #{p.id} · {p.cpm2CarCode ? `Car ${p.cpm2CarCode}` : "No car code"} · {formatPrice(p.basePriceCents, p.currency)} · {p.stockQuantity} in stock
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                              setShowProductForm(true);
                              void selectProduct(p);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      ))}
                    </div>
                          )}
                        </section>

    </StoreShell>
  );
}
