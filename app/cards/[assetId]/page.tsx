import type { Metadata } from "next";
import { WildsCardPage } from "@/features/play/WildsCardPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ assetId: string }> }): Promise<Metadata> {
  const { assetId } = await params;
  return {
    title: `Wildz Card · ${decodeURIComponent(assetId)}`,
    description: "A standalone portable Wildz card proof surface."
  };
}

export default async function StandaloneWildzCardPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  return <WildsCardPage assetId={decodeURIComponent(assetId)} />;
}
