import type { MetadataRoute } from "next";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: WILDZ_PRODUCT.name,
    short_name: "Wildz",
    description: WILDZ_PRODUCT.description,
    id: "/",
    start_url: "/",
    scope: "/",
    lang: "en-US",
    dir: "ltr",
    display: "standalone",
    orientation: "portrait-primary",
    launch_handler: {
      client_mode: "navigate-existing"
    },
    prefer_related_applications: false,
    background_color: WILDZ_PRODUCT.backgroundColor,
    theme_color: WILDZ_PRODUCT.themeColor,
    categories: ["games", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
