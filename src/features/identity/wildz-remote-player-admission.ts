import type { WildzContinuitySnapshot } from "../../lib/receiz/wildz-identity-adapter";
import type { WildzPlayerStateRecord } from "../../lib/receiz/wildz-player-state-sync";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { prepareWildsIncomingInventory } from "../play/wilds-incoming-inventory";
import { mergeWildsRemotePlayerPlayState } from "../play/wilds-player-vault";
import { hasLaterWildsPlayerLedger } from "../play/wilds-play-state-source";
import { isCurrentWildzGameplaySource } from "./wildz-gameplay-source";
import { mergePlayerContinuity } from "./wildz-restore";

/** Admission can span browser turns. Read live gameplay afterward so movement
 * is retained, and discard the result if identity or restore authority changed.
 */
export async function prepareWildzRemotePlayerSnapshot(
  source: WildzContinuitySnapshot,
  record: WildzPlayerStateRecord,
  current: () => WildzContinuitySnapshot | null
): Promise<WildzContinuitySnapshot | null> {
  if (!source.playState || !sameWildzPlayerCoordinate(source.session.actorId, record.playerId)
    || !sameWildzPlayerCoordinate(source.session.actorId, record.player.playerId)) return null;
  const inventory = await prepareWildsIncomingInventory(record.player.playState.inventory, source.playState.inventory);
  const latest = current();
  if (!latest?.playState || !isCurrentWildzGameplaySource(latest, source)) return null;
  // Ownership reconciliation can finish while admission yields. An older
  // download cannot restore cards removed from this same gameplay source.
  const currentIds = new Set(latest.playState.inventory.map(card => card.id));
  const removedIds = new Set(source.playState.inventory.filter(card => !currentIds.has(card.id)).map(card => card.id));
  const restored = { ...record.player.playState, inventory: inventory.filter(card => !removedIds.has(card.id)) };
  const remoteIsNewer = hasLaterWildsPlayerLedger(restored, latest.playState);
  return {
    ...latest,
    playState: mergeWildsRemotePlayerPlayState({ local: latest.playState, restored, actorId: latest.session.actorId }),
    character: remoteIsNewer ? record.player.character ?? latest.character : latest.character,
    playerContinuity: {
      ...mergePlayerContinuity(latest.playerContinuity, record.player)!,
      settings: remoteIsNewer ? record.player.settings : latest.playerContinuity?.settings ?? record.player.settings
    }
  };
}
