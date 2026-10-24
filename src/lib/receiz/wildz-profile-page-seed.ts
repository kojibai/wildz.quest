import type { PublicWildzProfileRecord } from "./wildz-profile-record";
import type { WildzProfilePageSeed } from "../../features/profile/profile-page-seed";
import type { PublicWildzCard } from "../../features/profile/public-profile";
import { verifyAnyWildsCard, type PortableCardAsset } from "../../features/play/portable-card";
import { calculateWildzMarketLocalValueV129, calculateWildzMarketLocalSummaryV129 } from "../../features/market/wildz-market-value-local-v129";
import { profileVaultCardImageUrl } from "../../features/profile/profile-vault-card";
import { receizKaiNow } from "@receiz/sdk";
import { publicWildzProfileCards } from "./wildz-profile-record";
import { createWildzProfileVaultPacket } from "../../features/profile/profile-vault-packet";
import { WILDZ_PROFILE_INITIAL_CARDS } from "../../features/profile/profile-viewport";

/** Every held card supplies a settled badge; only the first viewport needs
 * prepared charts and artwork. Never recover offscreen Originals before paint. */
export async function prepareWildzProfilePageSeed(record: PublicWildzProfileRecord, readCard?: (card: PublicWildzCard) => Promise<PortableCardAsset | null>, prepareArtwork?: (card: PortableCardAsset) => void | Promise<void>): Promise<WildzProfilePageSeed> {
  const at = String(receizKaiNow().uPulse);
  const held = publicWildzProfileCards(record), byId = new Map(held.map(asset => [asset.id, asset]));
  const summaries = Object.fromEntries(record.profile.vault.slice(WILDZ_PROFILE_INITIAL_CARDS).flatMap(card => {
    const asset = byId.get(card.id);
    if (!asset || asset.proof.digest !== card.proofDigest || asset.manifest.name !== card.name) return [];
    const value = calculateWildzMarketLocalSummaryV129(asset, { valuationKaiUPulse: at });
    return value ? [[card.id, value]] : [];
  }));
  let vaultPacket = record.vaultPacket ?? createWildzProfileVaultPacket(held);
  const prepared = await Promise.allSettled(record.profile.vault.slice(0, WILDZ_PROFILE_INITIAL_CARDS).map(async card => {
    const candidate = byId.get(card.id) ?? await readCard?.(card);
    if (!candidate || candidate.id !== card.id || !verifyAnyWildsCard(candidate).ok) return null;
    const artworkAsset = candidate;
    await prepareArtwork?.(artworkAsset);
    const artwork = `${profileVaultCardImageUrl(card.id, record.handle)}&digest=${encodeURIComponent(artworkAsset.proof.digest)}`;
    const asset = candidate.manifest.name === card.name && candidate.proof.digest === card.proofDigest ? candidate : null;
    // The image route already displays the latest verified public front. Reuse
    // that read when an older profile references another proof, without using
    // the different revision for values, custody or the carried Vault packet.
    if (!asset) return { id: card.id, asset: null, artwork };
    const value = await calculateWildzMarketLocalValueV129(asset, { valuationKaiUPulse: at });
    if (value.status === "ready") {
      const { localModel: _model, sdkProjection: _sdk, replay: _replay, ...display } = value.value;
      return { id: card.id, asset, value: { status: "ready" as const, value: { ...display, calculation: [], detailsDeferred: true } }, artwork };
    }
    return { id: card.id, asset, value, artwork };
  }));
  const rows = prepared.flatMap(result => result.status === "fulfilled" && result.value ? [result.value] : []);
  // Legacy reference-only profiles may recover these cards once. Keep that
  // result too, so opening their chart or flip never repeats the same read.
  vaultPacket ??= createWildzProfileVaultPacket(rows.flatMap(row => row.asset ? [row.asset] : []));
  return { profile: record.profile, cards: [], values: Object.fromEntries(rows.flatMap(row => row.value ? [[row.id, row.value]] : [])), summaries, artwork: Object.fromEntries(rows.map(row => [row.id, row.artwork])), ...(vaultPacket ? { vaultPacket } : {}) };
}
