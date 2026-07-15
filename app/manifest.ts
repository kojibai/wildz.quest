import type { MetadataRoute } from "next";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";

export default function manifest(): MetadataRoute.Manifest {
  return { name: WILDZ_PRODUCT.name, short_name: "Wildz", description: WILDZ_PRODUCT.description, id: "/", start_url: "/", scope: "/", display: "standalone", orientation: "any", background_color: "#09110d", theme_color: WILDZ_PRODUCT.themeColor, categories: ["games", "social"], icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ] };
}
