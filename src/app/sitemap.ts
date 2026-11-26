import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Generated sitemap: the canonical origin comes from NEXT_PUBLIC_SITE_URL,
 *  so a preview or custom domain never advertises the production Vercel URL. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  const routes: Array<[string, MetadataRoute.Sitemap[number]["changeFrequency"], number]> = [
    ["/", "weekly", 1],
    ["/store", "daily", 0.9],
    ["/store/cpm1", "daily", 0.8],
    ["/store/cpm2", "daily", 0.8],
    ["/store/products", "daily", 0.7],
    ["/store/cart", "weekly", 0.5],
    ["/store/support", "monthly", 0.4],
    ["/legal/terms", "yearly", 0.3],
    ["/legal/privacy", "yearly", 0.3],
    ["/legal/refund", "yearly", 0.3],
    ["/legal/delivery", "yearly", 0.3],
    ["/legal/payment", "yearly", 0.3],
    ["/legal/cancellation", "yearly", 0.3],
    ["/legal/appointment", "yearly", 0.3],
    ["/legal/dispute", "yearly", 0.3],
  ];
  return routes.map(([path, changeFrequency, priority]) => ({
    url: `${origin}${path}`,
    changeFrequency,
    priority,
  }));
}
