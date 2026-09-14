import { createWildsPlayerVault } from "../../features/play/wilds-player-vault";
import type { WildzPlayerStateProjectionInput } from "./wildz-player-state-serializer";

export type WildzPlayerProjectionMessage = {
  id: string;
  input: WildzPlayerStateProjectionInput;
  reuseInventory?: boolean;
};

/** A single worker retains the inventory between movement-only snapshots. */
export function createWildzPlayerProjectionEncoder() {
  let inventory: WildzPlayerStateProjectionInput["playState"]["inventory"] | undefined;
  return (message: WildzPlayerProjectionMessage) => {
    if (message.reuseInventory && !inventory) throw new Error("wildz_player_projection_inventory_missing");
    const input = message.reuseInventory
      ? { ...message.input, playState: { ...message.input.playState, inventory: inventory! } }
      : message.input;
    const player = createWildsPlayerVault(input);
    // Cache only after normalization/verification succeeds.
    inventory = player.playState.inventory;
    return JSON.stringify({ player });
  };
}
