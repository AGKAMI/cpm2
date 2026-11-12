import { Metadata } from "next";
import { StoreHome } from "@/components/StoreHome";

export const metadata: Metadata = {
  title: "VANTA GARAGE - CPM2 vehicles for sale",
  description: "Premium CPM2 vehicle storefront. Ready-to-purchase cars, limited editions, One of One builds.",
};

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const [productsRes, categoriesRes, promotionsRes] = await Promise.all([
    fetch("/api/store/products", { cache: "no-store" }),
    fetch("/api/store/categories", { cache: "no-store" }),
    fetch("/api/store/promotions", { cache: "no-store" }),
  ]);

  const { products, total } = (await productsRes.json()) as {
    products: unknown[];
    total: number;
  };
  const { categories } = (await categoriesRes.json()) as {
    categories: unknown[];
  };
  const { promotions } = (await promotionsRes.json()) as {
    promotions: unknown[];
  };

  return (
    <StoreHome
      products={products as unknown[]}
      categories={categories as unknown[]}
      promotions={promotions as unknown[]}
    />
  );
}
