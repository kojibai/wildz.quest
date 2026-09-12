import { canonicalPublicCardPath, parsePublicCardParam } from "@/features/play/public-card-registry";
import { permanentRedirect } from "next/navigation";

export default async function CompactWildzCardPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const parsed = parsePublicCardParam(assetId);
  permanentRedirect(canonicalPublicCardPath(parsed.assetId));
}
