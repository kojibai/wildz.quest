import type { MetadataRoute } from "next";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: WILDZ_PRODUCT.origin,
    lastModified: "2026-08-17",
    changeFrequency: "weekly",
    priority: 1
  }];
}
