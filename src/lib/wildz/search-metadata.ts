import type { Metadata } from "next";
import { WILDZ_PRODUCT } from "./product";

/** Static metadata only; no SDK, identity, gameplay, or network dependencies. */
export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  const displayTitle = `${title} · ${WILDZ_PRODUCT.name}`;
  return {
    title, description, alternates: { canonical: path },
    openGraph: { type: "website", title: displayTitle, description, url: path,
      siteName: WILDZ_PRODUCT.name, images: [{ url: WILDZ_PRODUCT.socialImage, width: 1200, height: 630, alt: "Wildz living creature adventure" }] },
    twitter: { card: "summary_large_image", title: displayTitle, description, images: [WILDZ_PRODUCT.socialImage] }
  };
}
