import { Metadata } from "next";
import { StoreHome } from "@/components/StoreHome";
import {
  listProducts,
  listCategories,
  listPromotions,
} from "@/lib/store/products";

export const metadata: Metadata = {
  title: "VANTA GARAGE - CPM2 vehicles for sale",
  description: "Premium CPM2 vehicle storefront. Ready-to-purchase cars, limited editions, One of One builds.",
};

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const [products, categories, promotions] = await Promise.all([
    listProducts({ onlyPublished: true }),
    listCategories(),
    listPromotions(),
  ]);

  return (
    <StoreHome
      products={products}
      categories={categories}
      promotions={promotions}
    />
  );
}
