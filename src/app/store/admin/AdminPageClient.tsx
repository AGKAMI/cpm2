/** VANTA GARAGE — admin product manager client component.
 * /store/admin — client-side interactivity only.
 * Data is fetched server-side and passed in as props.
 */

"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { carByCode, type CarEntry } from "@/lib/car-catalog";
import { formatPrice, type VantaProduct, type VantaCategory, type VantaPromotion } from "@/lib/store/client";
import { vantaApi } from "@/lib/store/client";
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

type AdminPageClientProps = {
  products: VantaProduct[];
  categories: VantaCategory[];
  promotions: VantaPromotion[];
};

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
  isSale: boolean;
  isPublished: boolean;
  categoryId: string;
  game: "cpm2" | "cpm1";
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
  isSale: false,
  isPublished: true,
  categoryId: "",
  game: "cpm2",
};

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  game: "cpm2" | "cpm1";
};

const EMPTY_CATEGORY_FORM: CategoryForm = {
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
  game: "cpm2",
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
  ctaLink: "/store",
  backgroundColor: "var(--color-paper-raised)",
  accentColor: "#d4af4f",
  imageUrl: "",
  isActive: true,
  sortOrder: "0",
};

const ProductListItem = memo(({ p, categories, onEdit, onPublish, onDelete }: {
  p: VantaProduct;
  categories: VantaCategory[];
  onEdit: () => void;
  onPublish: (id: number, publish: boolean) => void;
  onDelete: (id: number, name: string) => Promise<void>;
}) => {
  return (
    <article
      key={p.id}
      className={`panel rounded-xl border p-4 min-w-0 ${p.stockQuantity === 0 ? "border-oxblood bg-oxblood/5" : "border-border"}`}
    >
      <div className="flex items-baseline justify-between mb-2 min-w-0">
        <span className="text-xs font-mono text-muted-foreground truncate min-w-0">#{p.id}</span>
        <span className={`text-xs ${p.isPublished ? "text-primary" : "text-muted-foreground"} font-medium capitalize`}>
          {p.isPublished ? "published" : "unpublished"}
        </span>
      </div>
      <h4 className="text-sm font-medium text-foreground truncate">{p.name}</h4>
      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <span className="text-primary font-semibold">{formatPrice(p.basePriceCents, p.currency)}</span>
        <span className={`text-xs ml-2 font-medium ${p.stockQuantity === 0 ? "text-oxblood" : "text-muted-foreground"}`}>
          {p.stockQuantity === 0 ? "Out of stock" : `${p.stockQuantity} left`}
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${p.game === "cpm1" ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"}`}
          title={p.game === "cpm1" ? "CPM1 Catalogue" : "CPM2 Garage"}
        >
          {p.game === "cpm1" ? "CPM1" : "CPM2"}
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
        {p.isNew && <span className="bd bd-new text-[10px] font-bold px-2 py-0.5 rounded">New</span>}
        {p.isSale && <span className="bd bd-sale text-[10px] font-bold px-2 py-0.5 rounded">Sale</span>}
        {p.isFeatured && <span className="bd bd-featured text-[10px] font-bold px-2 py-0.5 rounded">Featured</span>}
      </div>
      {p.stockQuantity === 0 && (
        <p className="text-[10px] uppercase tracking-[0.15em] text-oxblood mt-1">
          Out of stock - edit to restock
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={() => onPublish(p.id, !p.isPublished)}>
          {p.isPublished ? "Unpublish" : "Publish"}
        </Button>
        <Button variant="ghost" size="sm" onClick={async () => { await onDelete(p.id, p.name); }} className="text-destructive hover:bg-destructive/10">
          Delete
        </Button>
      </div>
    </article>
  );
});
ProductListItem.displayName = "ProductListItem";

export default function AdminPageClient({ products, categories, promotions }: AdminPageClientProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [inlineEditingId, setInlineEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const toast = useToast();
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [categoryErrors, setCategoryErrors] = useState<Record<string, string>>({});
  const [promotionErrors, setPromotionErrors] = useState<Record<string, string>>({});
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(EMPTY_CATEGORY_FORM);
  const [categorySaving, setCategorySaving] = useState(false);
  const [inlineEditingCategoryId, setInlineEditingCategoryId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  // Catalogue browsing state: game separation + search + filters + sorting.
  const [catalogueGame, setCatalogueGame] = useState<"all" | "cpm1" | "cpm2">("all");
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [catalogueCategory, setCatalogueCategory] = useState("");
  const [catalogueSort, setCatalogueSort] = useState("newest");
  const [showPromotionForm, setShowPromotionForm] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState<number | null>(null);
  const [promotionForm, setPromotionForm] = useState<PromotionForm>(EMPTY_PROMOTION_FORM);
  const [promotionSaving, setPromotionSaving] = useState(false);
  const [carQuery, setCarQuery] = useState("");
  const [carOpen, setCarOpen] = useState(false);
  const [pickedCar, setPickedCar] = useState<CarEntry | null>(null);

  /** The catalogue rows after game filter, search, category filter and sort. */
  const catalogueRows: VantaProduct[] = (() => {
    const q = catalogueSearch.trim().toLowerCase();
    let rows = products.filter((p) => {
      if (catalogueGame === "cpm1" && p.game !== "cpm1") return false;
      if (catalogueGame === "cpm2" && p.game === "cpm1") return false;
      if (catalogueCategory && String(p.categoryId ?? "") !== catalogueCategory) return false;
      if (q && !(`${p.name} #${p.id}`.toLowerCase().includes(q))) return false;
      return true;
    });
    const byName = (a: VantaProduct, b: VantaProduct) => a.name.localeCompare(b.name);
    rows = [...rows].sort((a, b) => {
      switch (catalogueSort) {
        case "oldest": return a.id - b.id;
        case "name": return byName(a, b);
        case "price_asc": return a.basePriceCents - b.basePriceCents;
        case "price_desc": return b.basePriceCents - a.basePriceCents;
        case "stock_asc": return a.stockQuantity - b.stockQuantity;
        case "stock_desc": return b.stockQuantity - a.stockQuantity;
        case "category": return (a.categoryId ?? 0) - (b.categoryId ?? 0);
        default: return b.id - a.id; // newest
      }
    });
    return rows;
  })();
  const [cars, setCars] = useState<CarEntry[]>([]);
  const [productConverterFile, setProductConverterFile] = useState<File | null>(null);
  const [productConverterResult, setProductConverterResult] = useState<string | null>(null);
  const [productConverterError, setProductConverterError] = useState<string | null>(null);
  const [productConverterUploading, setProductConverterUploading] = useState(false);
  const [promotionConverterFile, setPromotionConverterFile] = useState<File | null>(null);
  const [promotionConverterResult, setPromotionConverterResult] = useState<string | null>(null);
  const [promotionConverterError, setPromotionConverterError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promoFileInputRef = useRef<HTMLInputElement>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  const loadCars = useCallback(async () => {
    try {
      const carsRes = await fetch("/api/store/cars").then((r) => r.json());
      if (carsRes && Array.isArray(carsRes.cars)) setCars(carsRes.cars);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    loadCars();
  }, [loadCars]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes, promoRes] = await Promise.all([
        vantaApi.products({}),
        vantaApi.categories(),
        vantaApi.promotions(),
      ]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load products, categories, or promotions.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const resetCategoryForm = () => {
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setShowCategoryForm(false);
    setInlineEditingCategoryId(null);
    setError(null);
    setMsg(null);
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
      isSale: p.isSale,
      isPublished: p.isPublished,
      categoryId: String(p.categoryId ?? ""),
      game: p.game === "cpm1" ? "cpm1" : "cpm2",
    });
    setEditingId(p.id);
    setInlineEditingId(p.id);
    setMsg(null);

    try {
      const { media } = await vantaApi.media(p.id);
      if (media.length > 0) {
        setForm((f) => ({ ...f, imageUrl: media[0].publicUrl }));
      }
    } catch {
      // Media fetch is non-fatal
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setProductErrors({});
    const validated = validateProductForm(form);
    if (!validated.ok) {
      setProductErrors(validated.errors);
      toast.error("Fix the following:", Object.values(validated.errors).join(". "));
      setSaving(false);
      return;
    }
    if (form.cpm2CarCode && !carByCode(Number(form.cpm2CarCode), "cpm2")) {
      toast.error("Invalid car code.", "Pick a car from the catalog search.");
      setSaving(false);
      return;
    }
    const v = validated.data;
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
        basePriceCents: Math.round(parseFloat(v.basePriceCents) * 100),
        currency: v.currency,
        stockQuantity: v.stockQuantity ? parseInt(v.stockQuantity, 10) : 0,
        airSuspension: form.airSuspension,
        unlockedBodykits: form.unlockedBodykits,
        hdLogo: form.hdLogo,
        isFeatured: form.isFeatured,
        isSale: form.isSale,
        isPublished: form.isPublished,
        categoryId: v.categoryId ? Number(v.categoryId) : undefined,
      };
      if (editingId) {
        await vantaApi.updateProduct(editingId, body);
        toast.success("Product updated.");
      } else {
        await vantaApi.createProduct(body);
        await fetch("/api/store/admin/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json", credentials: "include" },
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

  const handleCategorySubmit = async (e: React.FormEvent, editId?: number) => {
    e.preventDefault();
    setCategorySaving(true);
    setError(null);
    setCategoryErrors({});
    const validated = validateCategoryForm(categoryForm);
    if (!validated.ok) {
      setCategoryErrors(validated.errors);
      toast.error("Fix the following:", Object.values(validated.errors).join(". "));
      setCategorySaving(false);
      return;
    }
    const v = validated.data;
    try {
      if (editId) {
        await vantaApi.updateCategory(editId, {
          name: v.name,
          slug: v.slug,
          description: v.description,
          sortOrder: parseInt(v.sortOrder, 10),
          game: v.game,
        });
        setMsg("Category updated.");
        setInlineEditingCategoryId(null);
      } else {
        await vantaApi.createCategory({
          name: v.name,
          slug: v.slug,
          description: v.description,
          sortOrder: parseInt(v.sortOrder, 10),
          game: v.game,
        });
        setMsg("Category created.");
        resetCategoryForm();
      }
      await load();
    } catch (err) {
      toast.error(editId ? "Update failed" : "Category failed", err instanceof Error ? err.message : "Failed to save category.");
    } finally {
      setCategorySaving(false);
    }
  };

  const handleCategoryDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? It will be hidden from the store.`)) return;
    setError(null);
    try {
      await vantaApi.deleteCategory(id);
      setMsg(`Category "${name}" deleted.`);
      setInlineEditingCategoryId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category.");
    }
  };

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
    const validated = validatePromotionForm(promotionForm);
    if (!validated.ok) {
      setPromotionErrors(validated.errors);
      toast.error("Fix the following:", Object.values(validated.errors).join(". "));
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
        await fetch("/api/store/admin/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json", credentials: "include" },
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
      toast.error("Promotion failed", err instanceof Error ? err.message : "Failed to save promotion.");
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

  const carLocked = editingId !== null && form.cpm2CarCode !== "";
  const carMatches = cars.filter(
    (c) => !carQuery || c.name.toLowerCase().includes(carQuery.toLowerCase())
  ).slice(0, 30);

  return (
    <StoreShell>
      <PageHeading folio="AD" title="Admin - Product Manager" backHref="/store" />
      <Toast />

      <div className="mb-6 flex items-center gap-2">
        <Link href="/store/admin/accounts" className="inline-flex items-center gap-2 px-4 py-2 text-[9px] uppercase tracking-[0.15em] whitespace-nowrap cursor-pointer font-bold border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          Accounts
        </Link>
        <Link href="/store/admin/eft" className="inline-flex items-center gap-2 px-4 py-2 text-[9px] uppercase tracking-[0.15em] whitespace-nowrap cursor-pointer font-bold border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          EFT Review
        </Link>
        <Button variant="outline" onClick={() => router.push("/store")} size="sm">
          Back to store
        </Button>
      </div>

      <section className="admin-section panel rounded-xl border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="admin-section-title">Categories</h3>
          <Button variant="outline" size="sm" onClick={() => { setInlineEditingCategoryId(null); setShowCategoryForm(!showCategoryForm); }}>
            {showCategoryForm ? "Hide" : "Add Category"}
          </Button>
        </div>
        {showCategoryForm && !inlineEditingCategoryId && (
          <form onSubmit={handleCategorySubmit} className="flex flex-col gap-3 mb-4">
<Field label="Store" hint="Which catalogue this shelf belongs to">
              <select
                value={categoryForm.game}
                onChange={(e) => handleCategoryChange("game", e.target.value === "cpm1" ? "cpm1" : "cpm2")}
                className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
              >
                <option value="cpm2">CPM2 Garage</option>
                <option value="cpm1">CPM1 Catalogue</option>
              </select>
            </Field>
  <Field label="Store" hint="Which catalogue this shelf belongs to">
              <select
                value={categoryForm.game}
                onChange={(e) => handleCategoryChange("game", e.target.value === "cpm1" ? "cpm1" : "cpm2")}
                className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
              >
                <option value="cpm2">CPM2 Garage</option>
                <option value="cpm1">CPM1 Catalogue</option>
              </select>
            </Field>
                                  <Field label="Name" error={categoryErrors.name}>
              <TextInput value={categoryForm.name} onChange={(e) => handleCategoryChange("name", e.target.value)} placeholder="e.g. Sports Cars" />
            </Field>
            <Field label="URL slug" error={categoryErrors.slug} hint="Auto-generated from category name">
              <TextInput value={categoryForm.slug} onChange={(e) => handleCategoryChange("slug", e.target.value)} placeholder="sports-cars" />
            </Field>
            <Field label="Description" error={categoryErrors.description} hint="Optional description">
              <textarea value={categoryForm.description} onChange={(e) => handleCategoryChange("description", e.target.value)} placeholder="Optional description" className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground min-h-[60px] resize-y" />
            </Field>
            <Field label="Sort Order" error={categoryErrors.sortOrder} hint="Lower numbers appear first">
              <input type="number" value={categoryForm.sortOrder} onChange={(e) => handleCategoryChange("sortOrder", e.target.value)} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" type="submit" disabled={categorySaving} className="w-full sm:w-auto">
                {categorySaving ? "Creating…" : "Create Category"}
              </Button>
              <Button variant="outline" type="button" onClick={resetCategoryForm} disabled={categorySaving} className="w-full sm:w-auto">Cancel</Button>
            </div>
          </form>
        )}
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">No categories yet. Click “Add Category” to create one.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {categories.map((cat) => {
              const isInline = inlineEditingCategoryId === cat.id;
              if (isInline) {
                return (
                  <article key={cat.id} className="panel rounded-xl border border-border p-4 min-w-0">
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-xs font-mono text-muted-foreground">#{cat.id}</span>
                      <Button variant="ghost" size="sm" onClick={() => setInlineEditingCategoryId(null)}>Cancel</Button>
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); handleCategorySubmit(e, cat.id); }} className="flex flex-col gap-3">
                      <Field label="Name" error={categoryErrors.name}>
                        <TextInput value={categoryForm.name} onChange={(e) => handleCategoryChange("name", e.target.value)} placeholder="e.g. Sports Cars" />
                      </Field>
                      <Field label="URL slug" error={categoryErrors.slug} hint="Auto-generated from category name">
                        <TextInput value={categoryForm.slug} onChange={(e) => handleCategoryChange("slug", e.target.value)} placeholder="sports-cars" />
                      </Field>
                      <Field label="Description" error={categoryErrors.description} hint="Optional description">
                        <textarea value={categoryForm.description} onChange={(e) => handleCategoryChange("description", e.target.value)} placeholder="Optional description" className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground min-h-[60px] resize-y" />
                      </Field>
                      <Field label="Sort Order" error={categoryErrors.sortOrder} hint="Lower numbers appear first">
                        <input type="number" value={categoryForm.sortOrder} onChange={(e) => handleCategoryChange("sortOrder", e.target.value)} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
                      </Field>
                      <div className="flex flex-col gap-2">
                        <Button type="submit" variant="primary" disabled={categorySaving} className="w-full sm:w-auto">
                          {categorySaving ? "Saving…" : "Update Category"}
                        </Button>
                        <Button variant="ghost" type="button" size="sm" className="text-destructive hover:bg-destructive/10 w-full sm:w-auto" onClick={() => handleCategoryDelete(cat.id, cat.name)}>
                          Delete
                        </Button>
                      </div>
                    </form>
                  </article>
                );
              }
              return (
                <article key={cat.id} className="panel rounded-xl border border-border p-4 min-w-0">
                  <div className="flex items-baseline justify-between mb-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground truncate">{cat.name}</h4>
                    <span className="text-xs font-mono text-muted-foreground shrink-0">#{cat.id}</span>
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">
                    {cat.slug} · sort {cat.sortOrder}
                  </p>
                  {cat.description && (
                    <p className="text-xs text-ink-soft mb-3 break-words">{cat.description}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => { setShowCategoryForm(false); setCategoryForm({ name: cat.name, slug: cat.slug, description: cat.description, sortOrder: String(cat.sortOrder), game: cat.game ?? "cpm2" }); setInlineEditingCategoryId(cat.id); setError(null); setMsg(null); }}>Edit</Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleCategoryDelete(cat.id, cat.name)}>Delete</Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="admin-section panel rounded-xl border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="admin-section-title">Promotions</h3>
          <Button variant="outline" size="sm" onClick={() => { setShowPromotionForm(true); setEditingPromotionId(null); setPromotionForm(EMPTY_PROMOTION_FORM); setMsg(null); setError(null); }}>Add Promotion</Button>
        </div>

        {showPromotionForm && !editingPromotionId && (
          <form onSubmit={handlePromotionSubmit} className="flex flex-col gap-3 mb-4">
            <Field label="Title" error={promotionErrors.title}>
              <TextInput value={promotionForm.title} onChange={(e) => setPromotionForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Founders Weekend" />
            </Field>
            <Field label="Subtitle (eyebrow text)">
              <TextInput value={promotionForm.subtitle} onChange={(e) => setPromotionForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="Special offer" />
            </Field>
            <Field label="Description" error={promotionErrors.description}>
              <TextInput value={promotionForm.description} onChange={(e) => setPromotionForm((f) => ({ ...f, description: e.target.value }))} placeholder="10% off every Limited Edition" />
            </Field>
            <Field label="Discount %">
              <input type="number" min="0" max="100" value={promotionForm.discountPercent} onChange={(e) => setPromotionForm((f) => ({ ...f, discountPercent: e.target.value }))} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
            </Field>
            <Field label="Discount Code">
              <TextInput value={promotionForm.discountCode} onChange={(e) => setPromotionForm((f) => ({ ...f, discountCode: e.target.value }))} placeholder="VANTA10" />
            </Field>
            <Field label="CTA Text">
              <TextInput value={promotionForm.ctaText} onChange={(e) => setPromotionForm((f) => ({ ...f, ctaText: e.target.value }))} placeholder="Shop now" />
            </Field>
            <Field label="CTA Link">
              <TextInput value={promotionForm.ctaLink} onChange={(e) => setPromotionForm((f) => ({ ...f, ctaLink: e.target.value }))} placeholder="/store/categories" />
            </Field>
            <Field label="Background Color">
              <input type="color" value={promotionForm.backgroundColor} onChange={(e) => setPromotionForm((f) => ({ ...f, backgroundColor: e.target.value }))} className="w-full h-10 border-none bg-transparent cursor-pointer" />
            </Field>
            <Field label="Accent Color">
              <input type="color" value={promotionForm.accentColor} onChange={(e) => setPromotionForm((f) => ({ ...f, accentColor: e.target.value }))} className="w-full h-10 border-none bg-transparent cursor-pointer" />
            </Field>
            <Field label="Image URL (optional background image)">
              <div className="relative group cursor-pointer">
                <input ref={promoFileInputRef} type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;
                  setPromotionConverterFile(file);
                  setPromotionConverterError(null);
                  try {
                    const dataUrl = await convertFileToDataUrl(await compressImageForUpload(file));
                    setPromotionConverterResult(dataUrl);
                    setPromotionForm((f) => ({ ...f, imageUrl: dataUrl }));
                    setPromotionConverterFile(null);
                    setPromotionConverterResult(null);
                  } catch {
                    setPromotionConverterError("Failed to read image file.");
                  }
                }} />
                <div onClick={() => promoFileInputRef.current?.click()} className={`flex items-center gap-2 w-full border border-input rounded-md bg-background px-3 py-2 text-sm ${promotionConverterFile ? "border-emerald-500 text-emerald-500 bg-emerald-50" : "border-border text-foreground hover:border-primary transition-colors"} cursor-pointer`}>
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
                <div className="relative mt-3 overflow-hidden rounded-md border border-border h-32" style={{ backgroundColor: promotionForm.backgroundColor || "var(--color-paper-raised)" }}>
                  {promotionForm.imageUrl && (
                    <>
                      <img src={promotionForm.imageUrl} alt="Banner preview" className="absolute inset-y-0 right-0 h-full w-[55%] object-cover" />
                      <div className="absolute inset-y-0 right-0 w-[55%] pointer-events-none" style={{ background: `linear-gradient(90deg, ${promotionForm.backgroundColor || "var(--color-paper-raised)"} 0%, transparent 100%)` }} />
                    </>
                  )}
                  <div className="relative z-10 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: promotionForm.accentColor || "#d4af4f" }}>
                      {promotionForm.subtitle || "Special offer"}
                    </p>
                    <p className="font-serif font-bold text-lg">{promotionForm.title || "Title"}</p>
                  </div>
                </div>
              )}
            </Field>
            <Field label="Active">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={promotionForm.isActive} onChange={(e) => setPromotionForm((f) => ({ ...f, isActive: e.target.checked }))} className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring" />
                <span className="text-base font-bold text-foreground">Show on home page</span>
              </div>
            </Field>
            <Field label="Sort Order">
              <input type="number" value={promotionForm.sortOrder} onChange={(e) => setPromotionForm((f) => ({ ...f, sortOrder: e.target.value }))} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
            </Field>
            <div className="flex flex-col gap-2">
              <Button type="submit" variant="primary" disabled={promotionSaving} className="w-full sm:w-auto">
                {promotionSaving ? "Saving…" : editingPromotionId ? "Update Promotion" : "Create Promotion"}
              </Button>
              <Button variant="outline" type="button" onClick={resetPromotionForm} disabled={promotionSaving} className="w-full sm:w-auto">Cancel</Button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-3">
          {promotions.length === 0 ? (
            <span className="text-xs text-muted-foreground">No promotions yet. Click &quot;Add Promotion&quot; to create one.</span>
          ) : (
            promotions.map((p) => {
              if (editingPromotionId === p.id) {
                return (
                  <article key={p.id} className="panel rounded-xl border border-border p-4 min-w-0">
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-xs font-mono text-muted-foreground">#{p.id}</span>
                      <Button variant="ghost" size="sm" onClick={resetPromotionForm}>Cancel</Button>
                    </div>
                    <form onSubmit={handlePromotionSubmit} className="flex flex-col gap-3">
                      <Field label="Title" error={promotionErrors.title}>
                        <TextInput value={promotionForm.title} onChange={(e) => setPromotionForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Founders Weekend" />
                      </Field>
                      <Field label="Subtitle (eyebrow text)">
                        <TextInput value={promotionForm.subtitle} onChange={(e) => setPromotionForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="Special offer" />
                      </Field>
                      <Field label="Description" error={promotionErrors.description}>
                        <TextInput value={promotionForm.description} onChange={(e) => setPromotionForm((f) => ({ ...f, description: e.target.value }))} placeholder="10% off every Limited Edition" />
                      </Field>
                      <Field label="Discount %">
                        <input type="number" min="0" max="100" value={promotionForm.discountPercent} onChange={(e) => setPromotionForm((f) => ({ ...f, discountPercent: e.target.value }))} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
                      </Field>
                      <Field label="Discount Code">
                        <TextInput value={promotionForm.discountCode} onChange={(e) => setPromotionForm((f) => ({ ...f, discountCode: e.target.value }))} placeholder="VANTA10" />
                      </Field>
                      <Field label="CTA Text">
                        <TextInput value={promotionForm.ctaText} onChange={(e) => setPromotionForm((f) => ({ ...f, ctaText: e.target.value }))} placeholder="Shop now" />
                      </Field>
                      <Field label="CTA Link">
                        <TextInput value={promotionForm.ctaLink} onChange={(e) => setPromotionForm((f) => ({ ...f, ctaLink: e.target.value }))} placeholder="/store/categories" />
                      </Field>
                      <Field label="Background Color">
                        <input type="color" value={promotionForm.backgroundColor} onChange={(e) => setPromotionForm((f) => ({ ...f, backgroundColor: e.target.value }))} className="w-full h-10 border-none bg-transparent cursor-pointer" />
                      </Field>
                      <Field label="Accent Color">
                        <input type="color" value={promotionForm.accentColor} onChange={(e) => setPromotionForm((f) => ({ ...f, accentColor: e.target.value }))} className="w-full h-10 border-none bg-transparent cursor-pointer" />
                      </Field>
                      <Field label="Image URL (optional background image)">
                        <div className="relative group cursor-pointer">
                          <input ref={promoFileInputRef} type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                            const file = e.target.files?.[0] ?? null;
                            if (!file) return;
                            setPromotionConverterFile(file);
                            setPromotionConverterError(null);
                            try {
                              const dataUrl = await convertFileToDataUrl(await compressImageForUpload(file));
                              setPromotionConverterResult(dataUrl);
                              setPromotionForm((f) => ({ ...f, imageUrl: dataUrl }));
                              setPromotionConverterFile(null);
                              setPromotionConverterResult(null);
                            } catch {
                              setPromotionConverterError("Failed to read image file.");
                            }
                          }} />
                          <div onClick={() => promoFileInputRef.current?.click()} className={`flex items-center gap-2 w-full border border-input rounded-md bg-background px-3 py-2 text-sm ${promotionConverterFile ? "border-emerald-500 text-emerald-500 bg-emerald-50" : "border-border text-foreground hover:border-primary transition-colors"} cursor-pointer`}>
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
                          <div className="relative mt-3 overflow-hidden rounded-md border border-border h-32" style={{ backgroundColor: promotionForm.backgroundColor || "var(--color-paper-raised)" }}>
                            {promotionForm.imageUrl && (
                              <>
                                <img src={promotionForm.imageUrl} alt="Banner preview" className="absolute inset-y-0 right-0 h-full w-[55%] object-cover" />
                                <div className="absolute inset-y-0 right-0 w-[55%] pointer-events-none" style={{ background: `linear-gradient(90deg, ${promotionForm.backgroundColor || "var(--color-paper-raised)"} 0%, transparent 100%)` }} />
                              </>
                            )}
                            <div className="relative z-10 p-3">
                              <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: promotionForm.accentColor || "#d4af4f" }}>
                                {promotionForm.subtitle || "Special offer"}
                              </p>
                              <p className="font-serif font-bold text-lg">{promotionForm.title || "Title"}</p>
                            </div>
                          </div>
                        )}
                      </Field>
                      <Field label="Active">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={promotionForm.isActive} onChange={(e) => setPromotionForm((f) => ({ ...f, isActive: e.target.checked }))} className="accent-primary w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring" />
                          <span className="text-base font-bold text-foreground">Show on home page</span>
                        </div>
                      </Field>
                      <Field label="Sort Order">
                        <input type="number" value={promotionForm.sortOrder} onChange={(e) => setPromotionForm((f) => ({ ...f, sortOrder: e.target.value }))} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
                      </Field>
                      <div className="flex flex-col gap-2">
                        <Button type="submit" variant="primary" disabled={promotionSaving} className="w-full sm:w-auto">
                          {promotionSaving ? "Saving…" : "Update Promotion"}
                        </Button>
                        <Button variant="ghost" type="button" size="sm" className="text-destructive hover:bg-destructive/10 w-full sm:w-auto" onClick={() => handlePromotionDelete(p.id)}>Delete</Button>
                      </div>
                    </form>
                  </article>
                );
              }
              return (
                <div key={p.id} className="promotion-card flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-muted-foreground">#{p.id}</span>
                      {p.isActive ? <span className="text-[10px] text-primary font-bold">ACTIVE</span> : <span className="text-[10px] text-muted-foreground">INACTIVE</span>}
                    </div>
                    <h4 className="text-sm font-medium text-foreground truncate">{p.title}</h4>
                    <p className="text-[10px] text-ink-soft truncate">{p.description || p.subtitle || ""}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {p.discountCode && <span className="text-[10px] font-bold text-gold">{p.discountCode}</span>}
                      {p.discountPercent > 0 && <span className="text-[10px] text-muted-foreground">{p.discountPercent}% off</span>}
                      <span className="text-[10px] text-muted-foreground">{p.ctaText}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-ink-faint">bg: {p.backgroundColor}</span>
                      <span className="text-[10px] text-ink-faint">accent: {p.accentColor}</span>
                      {p.imageUrl && <span className="text-[10px] text-ink-faint">image</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setShowPromotionForm(false); selectPromotion(p); setError(null); setMsg(null); }}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handlePromotionDelete(p.id)} className="text-destructive hover:bg-destructive/10">Delete</Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {!inlineEditingId && showProductForm && (
        <section className="admin-section panel rounded-xl border border-border p-6 mb-8">
          <h3 className="admin-section-title mb-4">{editingId ? "Edit product" : "Add product"}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Image" error={productErrors.imageUrl}>
              <div className="relative group cursor-pointer">
                <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;
                  setProductConverterError(null);
                  setProductConverterResult(null);
                  setProductConverterFile(null);
                  setProductConverterUploading(true);
                  try {
                    const uploadFile = await compressImageForUpload(file);
                    const formData = new FormData();
                    formData.append("file", uploadFile);
                    const res = await fetch("/api/store/admin/upload-image", { method: "POST", body: formData });
                    if (!res.ok) {
                      const errBody = await res.json().catch(() => ({}));
                      throw new Error(errBody.error?.message || "Upload failed");
                    }
                    const { url } = (await res.json()) as { url: string };
                    setForm((f) => ({ ...f, imageUrl: url }));
                    setProductConverterFile(file);
                    setProductConverterResult(url);
                  } catch (err) {
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
                }} />
                <div onClick={() => fileInputRef.current?.click()} className={`flex items-center gap-2 w-full border border-input rounded-md bg-background px-3 py-2 text-sm ${productConverterUploading ? "border-amber-500 text-amber-500 bg-amber-50" : productConverterFile ? "border-emerald-500 text-emerald-500 bg-emerald-50" : "border-border text-foreground hover:border-primary transition-colors"} cursor-pointer`}>
                  {productConverterUploading ? (
                    <>
                      <span className="text-xs font-bold animate-pulse">⟳</span>
                      Converting image…
                    </>
                  ) : productConverterFile ? (
                    <>
                      <span className="text-xs font-bold">✓</span>
                      {productConverterFile.name}
                      {productConverterResult && <span className="text-[10px] text-ink-soft ml-2">→ converted to URL</span>}
                    </>
                  ) : (
                    "Choose image"
                  )}
                </div>
              </div>
              {productConverterError && <p className="text-xs text-destructive mt-1">{productConverterError}</p>}
              {productConverterResult && (
                <div className="mt-3 border border-input rounded-md p-3 bg-background">
                  <img src={productConverterResult} alt="Preview" className="max-w-full max-h-48 rounded-md border border-border object-cover" width="200" height="150" loading="lazy" decoding="async" />
                  <p className="text-[10px] text-ink-soft mt-2">Live preview from URL</p>
                </div>
              )}
            </Field>
            {form.game === "cpm2" && (
              <>
<Field label="Store" hint="Which catalogue this product belongs to - CPM1 (accounts, flags, mods...) or CPM2 (cars)">
              <select
                id="product-game"
                value={form.game}
                onChange={(e) => {
                  const g = e.target.value === "cpm1" ? "cpm1" : "cpm2";
                  handleChange("game", g);
                  // a category from the other store must not ride along
                  const cat = categories.find((c) => c.id === Number(form.categoryId));
                  if (cat && (cat.game ?? "cpm2") !== g) handleChange("categoryId", "");
                }}
                className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground"
              >
                <option value="cpm2">CPM2 Garage</option>
                <option value="cpm1">CPM1 Catalogue</option>
              </select>
            </Field>
            <Field label="Car (CPM2 catalog)" error={productErrors.cpm2CarCode} hint={carLocked ? "Locked - car codes are set once at creation and cannot be changed" : editingId !== null ? "No car linked yet - pick one; the code locks once set" : "Pick a car from the catalog - it auto-fills the name below, then you can edit it"}>
              {carLocked ? (
                <select id="cpm2-car-code" disabled defaultValue={form.cpm2CarCode} aria-readonly="true" className="w-full border border-input bg-secondary px-3 py-2 rounded-md text-sm text-foreground cursor-not-allowed">
                  <option value={form.cpm2CarCode}>{carByCode(Number(form.cpm2CarCode), "cpm2")?.name ?? `#${form.cpm2CarCode}`}</option>
                </select>
              ) : pickedCar ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-muted-foreground">#{pickedCar.code}</span>
                    <span className="text-foreground">{pickedCar.name}</span>
                    <Button variant="ghost" size="sm" onClick={clearPickedCar} aria-label="Clear picked car">Clear</Button>
                  </div>
                  <div className="border border-input rounded-md px-2 py-1 bg-background">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Picked from catalog - name below is editable</span>
                  </div>
                </div>
              ) : (
                <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setCarOpen(false); }}>
                  <input id="cpm2-car-code" value={carQuery} onChange={(e) => { const v = e.target.value; setCarQuery(v); setCarOpen(true); if (v === "") { setForm((f) => ({ ...f, cpm2CarCode: "", name: "" })); setPickedCar(null); } }} onFocus={() => setCarOpen(true)} placeholder="Type a car name or code…" autoComplete="off" className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
                  {carOpen && (carMatches.length > 0 ? (
                    <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-border rounded-md bg-background shadow-lg" onMouseDown={(e) => e.preventDefault()}>
                      {carMatches.map((car) => (
                        <button key={car.code} type="button" onClick={() => pickCar(car)} className="block w-full text-left px-3 py-2 text-sm bg-background/95 hover:bg-background hover:border-primary border-b border-border last:border-b-0">
                          <span className="text-foreground">{car.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="absolute z-20 mt-1 w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-muted-foreground">
                      No car in the CPM2 catalog matches &quot;{carQuery}&quot;.
                    </div>
                  ))}
                </div>
              )}
            </Field>
              </>
            )}
            
            <Field label="Name" error={productErrors.name} hint='Auto-filled from the catalog pick above - edit for custom design names (e.g. "GOLF GTI III - Midnight Chrome")'>
              <TextInput id="name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="Toyota Supra MK4" />
            </Field>
            <Field label="Price (ZAR)" error={productErrors.basePriceCents} hint="Enter price in Rands, e.g. 60.00">
              <input id="price" type="number" step="0.01" min="0" max="200" value={form.basePriceCents} onChange={(e) => handleChange("basePriceCents", e.target.value)} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
            </Field>
            <Field label="Stock" error={productErrors.stockQuantity} hint="How many available - set to 0 to mark out of stock">
              <input id="stock" type="number" min={editingId === null ? 1 : 0} value={form.stockQuantity} onChange={(e) => { const v = e.target.value; if (v === "") { setForm((f) => ({ ...f, stockQuantity: v })); return; } setForm((f) => ({ ...f, stockQuantity: v })); }} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
            </Field>
            <Field label="Category" hint={categories.length === 0 ? "No categories yet - add some via the Categories tab" : "Select a category for filtering"}>
              <select id="category" value={form.categoryId} onChange={(e) => handleChange("categoryId", e.target.value)} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground">
                <option value="">Select a category</option>
                {categories.filter((c) => (c.game ?? "cpm2") === form.game).map((cat) => <option key={cat.id} value={String(cat.id)}>{cat.name}</option>)}
              </select>
            </Field>
            <Field label="Air suspension install" hint="This design includes air suspension installation">
              <label className="custom-checkbox">
                <input type="checkbox" id="air-suspension" checked={form.airSuspension} onChange={(e) => handleChange("airSuspension", e.target.checked)} />
                <div className="checkmark"></div>
                <span className="text-base font-bold text-foreground">Include air suspension</span>
              </label>
            </Field>
            <Field label="Unlocked bodykits" hint="This design unlocks bodykits">
              <label className="custom-checkbox">
                <input type="checkbox" id="unlocked-bodykits" checked={form.unlockedBodykits} onChange={(e) => handleChange("unlockedBodykits", e.target.checked)} />
                <div className="checkmark"></div>
                <span className="text-base font-bold text-foreground">Include unlocked bodykits</span>
              </label>
            </Field>
            <Field label="HD Logo" hint="This design includes a high-definition logo">
              <label className="custom-checkbox">
                <input type="checkbox" id="hd-logo" checked={form.hdLogo} onChange={(e) => handleChange("hdLogo", e.target.checked)} />
                <div className="checkmark"></div>
                <span className="text-base font-bold text-foreground">Include HD logo</span>
              </label>
            </Field>
            <Field label="Featured">
              <label className="custom-checkbox">
                <input type="checkbox" id="is-featured" checked={form.isFeatured} onChange={(e) => handleChange("isFeatured", e.target.checked)} />
                <div className="checkmark"></div>
                <span className="text-base font-bold text-foreground">Featured on home page</span>
              </label>
            </Field>
            <Field label="Sale">
              <label className="custom-checkbox">
                <input type="checkbox" id="is-sale" checked={form.isSale} onChange={(e) => handleChange("isSale", e.target.checked)} />
                <div className="checkmark"></div>
                <span className="text-base font-bold text-foreground">Show “Sale” badge</span>
              </label>
            </Field>
            <Field label="Published">
              <label className="custom-checkbox">
                <input type="checkbox" id="is-published" checked={form.isPublished} onChange={(e) => handleChange("isPublished", e.target.checked)} />
                <div className="checkmark"></div>
                <span className="text-base font-bold text-foreground">Visible to customers</span>
              </label>
            </Field>
            <div className="flex flex-col gap-2">
              <Button type="submit" variant="primary" disabled={saving} className="w-full sm:w-auto">
                {saving ? "Saving…" : editingId ? "Update product" : "Create product"}
              </Button>
              <Button variant="outline" type="button" onClick={resetForm} disabled={saving} className="w-full sm:w-auto">Reset</Button>
            </div>
          </form>
        </section>
      )}

      <section className="admin-section panel rounded-xl border border-border p-4">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="admin-section-title">Catalogue</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{products.length} product{products.length === 1 ? "" : "s"}</span>
            <Button variant="outline" size="sm" onClick={() => { setShowProductForm(true); setEditingId(null); setForm(EMPTY_FORM); setPickedCar(null); setMsg(null); setError(null); }}>
              {showProductForm ? "Hide form" : "Add product"}
            </Button>
          </div>
        </div>
        {products.length === 0 ? (
          <p className="text-muted-foreground">No products yet. Add your first above.</p>
        ) : (
          <>
            {/* ── Catalogue controls: game separation + filtering + sorting ──
                The old picker was a single-product dropdown — with 90+
                products there was no way to tell CPM1 from CPM2, to find a
                product, or to sort anything. */}
            <div className="mb-4 space-y-3">
              {/* Game tabs — the two catalogues never mix */}
              <div className="flex items-center gap-2">
                {([
                  ["all", `All (${products.length})`],
                  ["cpm1", `CPM 1 (${products.filter((p) => p.game === "cpm1").length})`],
                  ["cpm2", `CPM 2 (${products.filter((p) => p.game !== "cpm1").length})`],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setCatalogueGame(key); setSelectedProductId(null); }}
                    className={`rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${
                      catalogueGame === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Search + category filter + sort */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={catalogueSearch}
                  onChange={(e) => setCatalogueSearch(e.target.value)}
                  placeholder="Search name, #id…"
                  className="min-w-[160px] flex-1 border border-input bg-background px-3 py-1.5 rounded-md text-sm"
                />
                <select
                  value={catalogueCategory}
                  onChange={(e) => setCatalogueCategory(e.target.value)}
                  className="border border-input bg-background px-3 py-1.5 rounded-md text-sm"
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.game ? ` (${c.game === "cpm1" ? "CPM1" : "CPM2"})` : ""}
                    </option>
                  ))}
                </select>
                <select
                  value={catalogueSort}
                  onChange={(e) => setCatalogueSort(e.target.value)}
                  className="border border-input bg-background px-3 py-1.5 rounded-md text-sm"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Name A→Z</option>
                  <option value="price_asc">Price ↑</option>
                  <option value="price_desc">Price ↓</option>
                  <option value="stock_asc">Stock ↑</option>
                  <option value="stock_desc">Stock ↓</option>
                  <option value="category">Category</option>
                </select>
              </div>
              {/* The catalogue table itself — click a row to edit */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Game</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                      <th className="px-3 py-2">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogueRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                          No products match these filters.
                        </td>
                      </tr>
                    )}
                    {catalogueRows.map((p) => {
                      const cat = categories.find((c) => c.id === p.categoryId);
                      const price = p.discountPercent > 0
                        ? Math.round((p.basePriceCents * (100 - p.discountPercent)) / 100)
                        : p.basePriceCents;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => { setSelectedProductId(p.id); setInlineEditingId(null); }}
                          className={`cursor-pointer border-b border-border/60 last:border-0 hover:bg-primary/5 ${
                            selectedProductId === p.id ? "bg-primary/10" : ""
                          }`}
                        >
                          <td className="px-3 py-2 font-mono text-muted-foreground">{p.id}</td>
                          <td className="px-3 py-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              p.game === "cpm1" ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"
                            }`}>
                              {p.game === "cpm1" ? "CPM1" : "CPM2"}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium text-foreground">
                            <span className="line-clamp-1">{p.name}</span>
                            {p.promoPriceCents != null && (
                              <span className="ml-2 promo-pill" style={{ ["--pill-hue" as string]: p.promo?.pillColor ?? "#d4af4f" }}>
                                Promoted
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{cat?.name ?? "—"}</td>
                          <td className="px-3 py-2 text-right font-mono text-foreground">
                            {p.discountPercent > 0 && (
                              <span className="mr-1 text-muted-foreground line-through">
                                {formatPrice(p.basePriceCents, p.currency)}
                              </span>
                            )}
                            {formatPrice(price, p.currency)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-foreground">{p.stockQuantity}</td>
                          <td className="px-3 py-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              p.isPublished
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-ink-faint/15 text-ink-faint"
                            }`}>
                              {p.isPublished ? "LIVE" : "HIDDEN"}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ml-1 ${
                              p.stockQuantity <= 0 ? "bg-destructive/15 text-destructive" : "bg-border text-muted-foreground"
                            }`}>
                              {p.stockQuantity <= 0 ? "OUT" : "IN"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {catalogueRows.length} shown of {products.length} · click a row to edit it below
              </p>
            </div>

            {selectedProductId && (
              <div className="grid grid-cols-1 gap-3">
                {products.filter((p) => p.id === selectedProductId).map((p) => {
                  const isInline = inlineEditingId === p.id;
              if (isInline) {
                return (
                  <article key={p.id} className="panel rounded-xl border p-4 min-w-0">
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-xs font-mono text-muted-foreground">#{p.id}</span>
                      <Button variant="ghost" size="sm" onClick={() => setInlineEditingId(null)}>Cancel</Button>
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="flex flex-col gap-3">
                      <Field label="Image" error={productErrors.imageUrl}>
                        <div className="relative group cursor-pointer">
                          <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                            const file = e.target.files?.[0] ?? null;
                            if (!file) return;
                            setProductConverterFile(file);
                            setProductConverterError(null);
                            try {
                              const dataUrl = await convertFileToDataUrl(await compressImageForUpload(file));
                              setProductConverterResult(dataUrl);
                              setForm((f) => ({ ...f, imageUrl: dataUrl }));
                              setProductConverterFile(null);
                              setProductConverterResult(null);
                            } catch {
                              setProductConverterError("Failed to read image file.");
                            }
                          }} />
                          <div onClick={() => fileInputRef.current?.click()} className={`flex items-center gap-2 w-full border border-input rounded-md bg-background px-3 py-2 text-sm ${productConverterUploading ? "border-amber-500 text-amber-500 bg-amber-50" : productConverterFile ? "border-emerald-500 text-emerald-500 bg-emerald-50" : "border-border text-foreground hover:border-primary transition-colors"} cursor-pointer`}>
                            {productConverterUploading ? (
                              <>
                                <span className="text-xs font-bold animate-pulse">⟳</span>
                                Converting image…
                              </>
                            ) : productConverterFile ? (
                              <>
                                <span className="text-xs font-bold">✓</span>
                                {productConverterFile.name}
                                {productConverterResult && <span className="text-[10px] text-ink-soft ml-2">→ converted to URL</span>}
                              </>
                            ) : (
                              "Choose image"
                            )}
                          </div>
                        </div>
                        {productConverterError && <p className="text-xs text-destructive mt-1">{productConverterError}</p>}
                        {productConverterResult && (
                          <div className="mt-3 border border-input rounded-md p-3 bg-background">
                            <img src={productConverterResult} alt="Preview" className="max-w-full max-h-48 rounded-md border border-border object-cover" width="200" height="150" loading="lazy" decoding="async" />
                            <p className="text-[10px] text-ink-soft mt-2">Live preview from URL</p>
                          </div>
                        )}
                      </Field>
                      <Field label="Car (CPM2 catalog)" error={productErrors.cpm2CarCode} hint={carLocked ? "Car code is locked - set once at creation" : "Pick a car from the catalog - name auto-fills below"}>
                        {carLocked ? (
                          <select id="cpm2-car-code" disabled defaultValue={form.cpm2CarCode} aria-readonly="true" className="w-full border border-input bg-secondary px-3 py-2 rounded-md text-sm text-foreground cursor-not-allowed">
                            <option value={form.cpm2CarCode}>{carByCode(Number(form.cpm2CarCode), "cpm2")?.name ?? `#${form.cpm2CarCode}`}</option>
                          </select>
                        ) : pickedCar ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-muted-foreground">#{pickedCar.code}</span>
                              <span className="text-foreground">{pickedCar.name}</span>
                              <Button variant="ghost" size="sm" onClick={clearPickedCar} aria-label="Clear picked car">Clear</Button>
                            </div>
                            <div className="border border-input rounded-md px-2 py-1 bg-background">
                              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Picked from catalog - name below is editable</span>
                            </div>
                          </div>
                        ) : (
                          <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setCarOpen(false); }}>
                            <input id="cpm2-car-code" value={carQuery} onChange={(e) => { const v = e.target.value; setCarQuery(v); setCarOpen(true); if (v === "") { setForm((f) => ({ ...f, cpm2CarCode: "", name: "" })); setPickedCar(null); } }} onFocus={() => setCarOpen(true)} placeholder="Type a car name or code…" autoComplete="off" className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
                            {carOpen && (carMatches.length > 0 ? (
                              <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-border rounded-md bg-background shadow-lg" onMouseDown={(e) => e.preventDefault()}>
                                {carMatches.map((car) => (
                                  <button key={car.code} type="button" onClick={() => pickCar(car)} className="block w-full text-left px-3 py-2 text-sm bg-background/95 hover:bg-background hover:border-primary border-b border-border last:border-b-0">
                                    <span className="text-foreground">{car.name}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="absolute z-20 mt-1 w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-muted-foreground">
                                No car in the CPM2 catalog matches &quot;{carQuery}&quot;.
                              </div>
                            ))}
                          </div>
                        )}
                      </Field>
                      <Field label="Name" error={productErrors.name} hint='Auto-filled from the catalog pick above - edit for custom design names (e.g. "GOLF GTI III - Midnight Chrome")'>
                        <TextInput id="name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="Toyota Supra MK4" />
                      </Field>
                      <Field label="Price (ZAR)" error={productErrors.basePriceCents}>
                        <input type="number" step="0.01" min="0" value={form.basePriceCents} onChange={(e) => handleChange("basePriceCents", e.target.value)} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
                      </Field>
                      <Field label="Stock" error={productErrors.stockQuantity} hint={editingId === null ? "Locked at 1 for new products" : "How many available - set to 0 to mark out of stock"}>
                        <input type="number" min={editingId === null ? 1 : 0} value={editingId === null ? "1" : form.stockQuantity} onChange={editingId === null ? undefined : (e) => handleChange("stockQuantity", e.target.value)} readOnly={editingId === null} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground" />
                      </Field>
                      <Field label="Category" hint={categories.length === 0 ? "No categories yet - add some via the Categories tab" : "Select a category"}>
                        <select value={form.categoryId} onChange={(e) => handleChange("categoryId", e.target.value)} className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm text-foreground">
                          <option value="">Select a category</option>
                          {categories.map((cat) => <option key={cat.id} value={String(cat.id)}>{cat.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Air suspension install">
                        <label className="custom-checkbox">
                          <input type="checkbox" checked={form.airSuspension} onChange={(e) => handleChange("airSuspension", e.target.checked)} />
                          <div className="checkmark"></div>
                          <span className="text-base font-bold text-foreground">Include air suspension</span>
                        </label>
                      </Field>
                      <Field label="Unlocked bodykits">
                        <label className="custom-checkbox">
                          <input type="checkbox" checked={form.unlockedBodykits} onChange={(e) => handleChange("unlockedBodykits", e.target.checked)} />
                          <div className="checkmark"></div>
                          <span className="text-base font-bold text-foreground">Include unlocked bodykits</span>
                        </label>
                      </Field>
                      <Field label="HD Logo">
                        <label className="custom-checkbox">
                          <input type="checkbox" checked={form.hdLogo} onChange={(e) => handleChange("hdLogo", e.target.checked)} />
                          <div className="checkmark"></div>
                          <span className="text-base font-bold text-foreground">Include HD logo</span>
                        </label>
                      </Field>
                      <Field label="Sale">
                        <label className="custom-checkbox">
                          <input type="checkbox" checked={form.isSale} onChange={(e) => handleChange("isSale", e.target.checked)} />
                          <div className="checkmark"></div>
                          <span className="text-base font-bold text-foreground">Show “Sale” badge</span>
                        </label>
                      </Field>
                      <Field label="Published">
                        <label className="custom-checkbox">
                          <input type="checkbox" checked={form.isPublished} onChange={(e) => handleChange("isPublished", e.target.checked)} />
                          <div className="checkmark"></div>
                          <span className="text-base font-bold text-foreground">Visible to customers</span>
                        </label>
                      </Field>
                      <div className="flex flex-col gap-2">
                        <Button type="submit" variant="primary" disabled={saving} className="w-full sm:w-auto">{saving ? "Saving…" : "Update product"}</Button>
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
                            setSelectedProductId(null);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed to delete product.");
                          }
                        }} className="w-full sm:w-auto">Delete</Button>
                      </div>
                    </form>
                  </article>
                );
              }
              return (
                <ProductListItem
                  key={p.id}
                  p={p}
                  categories={categories}
                  onEdit={() => selectProduct(p)}
                  onPublish={(id, publish) => handlePublish(id, publish)}
                  onDelete={async (id, name) => {
                    if (!window.confirm(`Delete "${name}"? This will unpublish and mark unavailable.`)) return;
                    setError(null);
                    const scrollY = window.scrollY;
                    try {
                      await vantaApi.deleteProduct(id);
                      setMsg("Product deleted (unpublished & marked unavailable).");
                      await load();
                      window.scrollTo(0, scrollY);
                      setSelectedProductId(null);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to delete product.");
                    }
                  }}
                />
              );
            })}
              </div>
            )}
          </>
        )}
      </section>

    </StoreShell>
  );
}
