import type { Metadata } from "next";
import { WildsCardPage } from "@/features/play/WildsCardPage";
import { parsePublicCardParam } from "@/features/play/public-card-registry";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ assetId: string }> }): Promise<Metadata> {
  const { assetId } = await params;
  const parsed = parsePublicCardParam(assetId);
  return {
    title: `Wildz Card · ${parsed.assetId}`,
    description: "A standalone portable Wildz card proof surface."
  };
}

export default async function StandaloneWildzCardPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  return <WildsCardPage assetId={parsePublicCardParam(assetId).assetId} />;
}
