import type { Metadata } from "next";
import { WILDZ_PRODUCT } from "./product";

export type PublicPageSocialImage = { url: string; alt: string };

/** Static metadata only; no SDK, identity, gameplay, or network dependencies. */
export function publicPageMetadata(title: string, description: string, path: string, image?: PublicPageSocialImage): Metadata {
  const displayTitle = `${title} · ${WILDZ_PRODUCT.name}`;
  const imageUrl = new URL(image?.url ?? WILDZ_PRODUCT.socialImage, WILDZ_PRODUCT.origin).toString();
  const imageAlt = image?.alt ?? "Wildz living creature adventure";
  const imageType = /\.jpe?g$/i.test(new URL(imageUrl).pathname) ? "image/jpeg" : "image/png";
  return {
    title, description, alternates: { canonical: path },
    openGraph: { type: "website", title: displayTitle, description, url: path,
      siteName: WILDZ_PRODUCT.name, images: [{ url: imageUrl, secureUrl: imageUrl, width: 1200, height: 630, type: imageType, alt: imageAlt }] },
    twitter: { card: "summary_large_image", title: displayTitle, description, images: [{url: imageUrl, alt: imageAlt}] }
  };
}
