import { createWildsPlayerVault } from "../../features/play/wilds-player-vault";
import type { WildzPlayerStateProjectionInput } from "./wildz-player-state-serializer";

export type WildzPlayerProjectionMessage = {
  id: string;
  input: WildzPlayerStateProjectionInput;
  reuseInventory?: boolean;
  inventoryDelta?: { length: number; changes: Array<{ index: number; card: WildzPlayerStateProjectionInput["playState"]["inventory"][number] }> };
};

/** A single worker retains the inventory between movement-only snapshots. */
export function createWildzPlayerProjectionEncoder() {
  let inventory: WildzPlayerStateProjectionInput["playState"]["inventory"] | undefined;
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
    const input = message.reuseInventory || message.inventoryDelta
      ? { ...message.input, playState: { ...message.input.playState, inventory: nextInventory! } }
      : message.input;
    const player = createWildsPlayerVault(input);
    // Cache only after normalization/verification succeeds.
    inventory = player.playState.inventory;
    return JSON.stringify({ player });
  };
}
