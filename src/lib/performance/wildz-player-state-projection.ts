import { createWildsPlayerVault } from "../../features/play/wilds-player-vault";
import { mergeWildsExplorationAtlases, normalizeWildsExplorationAtlas, type WildsExplorationAtlas } from "../../features/play/wilds-exploration-atlas";
import type { WildzPlayerStateProjectionInput } from "./wildz-player-state-serializer";

export type WildzPlayerProjectionMessage = {
  id: string;
  input: WildzPlayerStateProjectionInput;
  reuseInventory?: boolean;
  atlasBaseId?: string;
  inventoryDelta?: { length: number; changes: Array<{ index: number; card: WildzPlayerStateProjectionInput["playState"]["inventory"][number] }> };
};

/** Worker-local references reduce copying. The emitted player vault stays complete. */
export function createWildzPlayerProjectionEncoder() {
  let inventory: WildzPlayerStateProjectionInput["playState"]["inventory"] | undefined;
  let lastAtlas: { id: string; owner: string; value: WildsExplorationAtlas } | undefined;
  return (message: WildzPlayerProjectionMessage) => {
    if (message.reuseInventory && !inventory) throw new Error("wildz_player_projection_inventory_missing");
    let nextInventory = inventory;
    if (message.inventoryDelta) {
      if (!inventory) throw new Error("wildz_player_projection_inventory_missing");
      nextInventory = inventory.slice(0, message.inventoryDelta.length);
      for (const { index, card } of message.inventoryDelta.changes) {
        if (!Number.isInteger(index) || index < 0 || index >= message.inventoryDelta.length) throw new Error("wildz_player_projection_delta_invalid");
        nextInventory[index] = card;
      }
      if (nextInventory.length !== message.inventoryDelta.length || Array.from(nextInventory).some(card => !card)) throw new Error("wildz_player_projection_delta_invalid");
    }
    const { input } = message;
    let territory = input.playState.explorationAtlas;
    if (message.atlasBaseId) {
      if (lastAtlas?.id !== message.atlasBaseId || lastAtlas.owner !== input.playerId) throw new Error("wildz_player_projection_atlas_missing");
      territory = territory.rows.length || territory.siteKeys.length
        ? mergeWildsExplorationAtlases(lastAtlas.value, territory) : lastAtlas.value;
    }
    // Keep the supplied territory independent of the sight around this particular
    // movement. The vault normalizer adds sight for each individual snapshot.
    const atlas = normalizeWildsExplorationAtlas(territory, { x: 0, z: 0 });
    const player = createWildsPlayerVault({
      ...input,
      playState: {
        ...input.playState,
        inventory: message.reuseInventory || message.inventoryDelta ? nextInventory! : input.playState.inventory,
        explorationAtlas: atlas
      }
    });
    // Cache only after normalization/verification succeeds.
    inventory = player.playState.inventory;
    lastAtlas = { id: message.id, owner: input.playerId, value: atlas };
    return JSON.stringify({ player });
  };
}
