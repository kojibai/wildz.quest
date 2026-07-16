import { canonicalPublicCardPath, parsePublicCardParam } from "@/features/play/public-card-registry";
import { redirect } from "next/navigation";

export default async function CompactWildzCardPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const parsed = parsePublicCardParam(assetId);
  redirect(canonicalPublicCardPath(parsed.assetId));
}
