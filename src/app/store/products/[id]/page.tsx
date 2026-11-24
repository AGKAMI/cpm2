import { Metadata } from "next";
import { ProductPageClient } from "@/components/ProductPageClient";
import { CategoryProductsClient } from "@/components/CategoryProductsClient";
import {
  getProduct,
  listProducts,
  listCategories,
} from "@/lib/store/products";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(Number(id)).catch(() => null);
  if (product) {
    return { title: `${product.name} - VANTA GARAGE` };
  }
  const category = (await listCategories()).find((c) => c.id === Number(id));
  return { title: category ? `${category.name} - VANTA GARAGE` : "VANTA GARAGE" };
}

/**
 * A tile in this app can name either a PRODUCT (detail page) or a CATEGORY
 * (its product list). Category tiles previously pointed here and rendered an
 * empty product page — the browse path was broken. Resolve both.
 */
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16: params is a Promise — must be awaited.
  const { id } = await params;
  const product = await getProduct(Number(id)).catch(() => null);
  if (product) return <ProductPageClient productId={id} />;

  const categories = await listCategories();
  const category = categories.find((c) => c.id === Number(id));
  if (category) {
    const products = (await listProducts({ onlyPublished: true })).filter(
      (p) => p.categoryId === category.id,
    );
    return (
      <CategoryProductsClient
        categoryName={category.name}
        game={category.game}
        products={products}
      />
    );
  }
  // Neither — fall through to the detail client, which renders its not-found state.
  return <ProductPageClient productId={id} />;
}