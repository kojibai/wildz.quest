import type { MetadataRoute } from "next";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";

// Published editorial routes only. No identity reads, player scans, or game state.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: WILDZ_PRODUCT.origin, changeFrequency: "weekly", priority: 1 },
    { url: `${WILDZ_PRODUCT.origin}/guide`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${WILDZ_PRODUCT.origin}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${WILDZ_PRODUCT.origin}/world`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${WILDZ_PRODUCT.origin}/creatures`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${WILDZ_PRODUCT.origin}/conformance`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${WILDZ_PRODUCT.origin}/laws`, changeFrequency: "monthly", priority: 0.4 }
  ];
}
