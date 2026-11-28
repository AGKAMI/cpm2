import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/store/admin/",
        "/store/owner/",
        "/store/checkout/",
        "/store/orders/",
        "/store/profile/",
        "/store/appointments/",
        "/store/wishlist/",
        "/store/support/",
        "/store/dashboard/",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
