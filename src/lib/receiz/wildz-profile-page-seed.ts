import type { PublicWildzProfileRecord } from "./wildz-profile-record";
import type { WildzProfilePageSeed } from "../../features/profile/profile-page-seed";
import type { PublicWildzCard } from "../../features/profile/public-profile";
import type { PortableCardAsset } from "../../features/play/portable-card";
import { parseProfileVaultPublicAsset } from "../../features/profile/profile-vault-card";
import { createPublicWildsCardRecord } from "../../features/play/public-card-registry";
import { calculateWildzMarketLocalValueV129 } from "../../features/market/wildz-market-value-local-v129";
import { profileVaultCardImageUrl } from "../../features/profile/profile-vault-card";
import { receizKaiNow } from "@receiz/sdk";

/** Carry the first viewport's display projection, never full history dossiers,
 * SVG strings or offline replays. The browser reuses the public image URL. */
export async function prepareWildzProfilePageSeed(record: PublicWildzProfileRecord, readCard?: (card: PublicWildzCard) => Promise<PortableCardAsset | null>, prepareArtwork?: (card: PortableCardAsset) => void): Promise<WildzProfilePageSeed> {
  const at = String(receizKaiNow().uPulse);
  const prepared = await Promise.allSettled(record.profile.vault.slice(0, 4).map(async card => {
    const candidate = record.vaultCards?.find(asset => asset.id === card.id) ?? await readCard?.(card);
    if (!candidate) return null;
    const asset = parseProfileVaultPublicAsset(card, { record: createPublicWildsCardRecord(candidate, record.sourceUrl, record.publishedAt) });
    if (!asset) return null;
    prepareArtwork?.(asset);
    const value = await calculateWildzMarketLocalValueV129(asset, { valuationKaiUPulse: at });
    if (value.status === "ready") {
      const { localModel: _model, sdkProjection: _sdk, replay: _replay, ...display } = value.value;
      return { asset, value: { status: "ready" as const, value: { ...display, calculation: [], detailsDeferred: true } }, artwork: `${profileVaultCardImageUrl(asset.id, record.handle)}&digest=${encodeURIComponent(asset.proof.digest)}` };
    }
    return { asset, value, artwork: `${profileVaultCardImageUrl(asset.id, record.handle)}&digest=${encodeURIComponent(asset.proof.digest)}` };
  }));
  const rows = prepared.flatMap(result => result.status === "fulfilled" && result.value ? [result.value] : []);
  return { profile: record.profile, cards: [], values: Object.fromEntries(rows.map(row => [row.asset.id, row.value])), artwork: Object.fromEntries(rows.map(row => [row.asset.id, row.artwork])) };
}
