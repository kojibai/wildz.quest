import type { MetadataRoute } from "next";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/test-fixtures/"]
    }],
    host: WILDZ_PRODUCT.origin,
    sitemap: [
      `${WILDZ_PRODUCT.origin}/sitemap.xml`,
      `${WILDZ_PRODUCT.origin}/image-sitemap.xml`
    ]
  };
}
