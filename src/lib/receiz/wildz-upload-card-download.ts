import { createWildsPlayerVault } from "../../features/play/wilds-player-vault";
import type { WildzCommittedArtifactRestore } from "../../features/identity/wildz-restore";
import type { createWildzIdentityOwnedCardPreparer } from "./wildz-identity-adapter";

/** Save the committed local card snapshot; never download the superseded upload
 * as though it were a new native custody artifact. Native claims save their exact
 * verified successor through the separate claim path. */
export async function downloadRestoredWildzCard(
  outcome: WildzCommittedArtifactRestore,
  uploadedAssetId: string,
  dependencies: {
    prepare: ReturnType<typeof createWildzIdentityOwnedCardPreparer>;
    download: (blob: Blob, filename: string) => void;
  }
) {
  if (outcome.restoreStatus !== "committed") throw new Error("wildz_upload_not_committed");
  const asset = outcome.playState.inventory.find(card => card.id === uploadedAssetId);
  if (!asset || !outcome.verifiedAssetIds.includes(uploadedAssetId)) throw new Error("wildz_upload_card_missing");
  const player = createWildsPlayerVault({
    playerId: outcome.session.username ?? outcome.session.actorId,
    exportedAt: new Date().toISOString(),
    playState: outcome.playState,
    character: outcome.character,
    ...outcome.playerContinuity
  });
  const prepared = await dependencies.prepare(outcome.session, asset, player, { allowPrompt: false });
  dependencies.download(new Blob([prepared.bytes.slice().buffer], { type: prepared.mimeType }), prepared.filename);
  return prepared;
}
