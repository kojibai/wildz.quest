import type { Metadata } from "next";
import { WildsCardPage } from "@/features/play/WildsCardPage";
import { parsePublicCardParam } from "@/features/play/public-card-registry";
import { resolvePublicWildsCardRecord } from "@/lib/receiz/wildz-public-card-resolver";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ assetId: string }> }): Promise<Metadata> {
  const { assetId } = await params;
  const parsed = parsePublicCardParam(assetId);
  return {
    title: `Wildz Card · ${parsed.assetId}`,
    description: "A standalone portable Wildz living creature card and proof-native history.",
    alternates: { canonical: `/cards/${encodeURIComponent(parsed.assetId)}` },
    openGraph: {
      type: "website",
      images: [WILDZ_PRODUCT.socialImage]
    }
  };
}

export default async function StandaloneWildzCardPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const parsed = parsePublicCardParam(assetId);
  const initialRecord = await resolvePublicWildsCardRecord(parsed.assetId, WILDZ_PRODUCT.origin).catch(() => null);
  return <WildsCardPage assetId={parsed.assetId} initialRecord={initialRecord} />;
}
