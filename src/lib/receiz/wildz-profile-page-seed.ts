import type { PublicWildzProfileRecord } from "./wildz-profile-record";
import type { WildzProfilePageSeed } from "../../features/profile/profile-page-seed";
import type { PublicWildzCard } from "../../features/profile/public-profile";
import type { PortableCardAsset } from "../../features/play/portable-card";
import { parseProfileVaultPublicAsset } from "../../features/profile/profile-vault-card";
import { createPublicWildsCardRecord } from "../../features/play/public-card-registry";
import { calculateWildzMarketLocalValueV129 } from "../../features/market/wildz-market-value-local-v129";
import { renderWildsCardSvg } from "../../features/play/card-svg";
import { receizKaiNow } from "@receiz/sdk";

/** Carry only the first viewport's exact proofs, fronts and charts in HTML.
 * The remaining public index is small; its cards prepare as they approach. */
export async function prepareWildzProfilePageSeed(record: PublicWildzProfileRecord, readCard?: (card: PublicWildzCard) => Promise<PortableCardAsset | null>): Promise<WildzProfilePageSeed> {
  const at = String(receizKaiNow().uPulse);
  const prepared = await Promise.allSettled(record.profile.vault.slice(0, 4).map(async card => {
    const candidate = record.vaultCards?.find(asset => asset.id === card.id) ?? await readCard?.(card);
    if (!candidate) return null;
    const asset = parseProfileVaultPublicAsset(card, { record: createPublicWildsCardRecord(candidate, record.sourceUrl, record.publishedAt) });
    if (!asset) return null;
    const value = await calculateWildzMarketLocalValueV129(asset, { valuationKaiUPulse: at });
    return { asset, value, artwork: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderWildsCardSvg(asset))}` };
  }));
  const rows = prepared.flatMap(result => result.status === "fulfilled" && result.value ? [result.value] : []);
  return { profile: record.profile, cards: rows.map(row => row.asset), values: Object.fromEntries(rows.map(row => [row.asset.id, row.value])), artwork: Object.fromEntries(rows.map(row => [row.asset.id, row.artwork])) };
}
