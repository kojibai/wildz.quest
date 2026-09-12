import { cache } from "react";
import { publicPageMetadata } from "@/lib/wildz/search-metadata";
import type { Metadata } from "next";
import { WildsCardPage } from "@/features/play/WildsCardPage";
import { parsePublicCardParam } from "@/features/play/public-card-registry";
import { resolvePublicWildsCardRecord } from "@/lib/receiz/wildz-public-card-resolver";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";

export const dynamic = "force-dynamic";
// Metadata and page share one request-scoped read; never fetch twice for SEO.
const publicCard = cache((assetId: string) => resolvePublicWildsCardRecord(assetId, WILDZ_PRODUCT.origin).catch(() => null));

export async function generateMetadata({ params }: { params: Promise<{ assetId: string }> }): Promise<Metadata> {
  const { assetId } = await params;
  const parsed = parsePublicCardParam(assetId);
  const record = await publicCard(parsed.assetId);
  const path = `/cards/${encodeURIComponent(parsed.assetId)}`;
  const title = record ? `${record.asset.manifest.name} — Creature Card` : "Creature Card";
  const description = record ? `Meet ${record.asset.manifest.name}, a Wildz creature companion. Explore this published card, its abilities, and verified history.` : "View a published Wildz creature card and its carried history.";
  const metadata = publicPageMetadata(title, description, path);
  const image = `${WILDZ_PRODUCT.origin}/api/cards/${encodeURIComponent(parsed.assetId)}/image`;
  return {
    ...metadata,
    ...(record ? {
      openGraph: { ...metadata.openGraph, images: [{ url: image, width: 500, height: 700, alt: `${record.asset.manifest.name} creature card` }] },
      twitter: { card: "summary_large_image" as const, title, description, images: [image] }
    } : { robots: { index: false, follow: true } })
  };
}

export default async function StandaloneWildzCardPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const parsed = parsePublicCardParam(assetId);
  const initialRecord = await publicCard(parsed.assetId);
  return <WildsCardPage assetId={parsed.assetId} initialRecord={initialRecord} />;
}
