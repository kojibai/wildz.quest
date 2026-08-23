import type { PlayState } from "@/features/play/game-state";
import type { WildsWalletReadResponse } from "./wilds-wallet-controller";

export type WildsWalletPlayStateSeed = Readonly<{
  resourceUnits: number;
  creatureCards: number;
  unavailableCreatureCards: number;
}>;

export function projectWildsWalletPlayStateSeed(state: Pick<PlayState, "beans" | "fusionSparks" | "ascensionCatalysts" | "inventory">): WildsWalletPlayStateSeed {
  return Object.freeze({
    resourceUnits: state.beans + state.fusionSparks + state.ascensionCatalysts.length,
    creatureCards: state.inventory.length,
    unavailableCreatureCards: state.inventory.filter((asset) => asset.status === "listed" || asset.status === "suspended" || asset.status === "revoked").length
  });
}

export function seedWildsWalletFromPlayState(
  response: WildsWalletReadResponse,
  seed: WildsWalletPlayStateSeed
): WildsWalletReadResponse {
  return Object.freeze({
    ...response,
    summary: Object.freeze({
      ...response.summary,
      assetCountsStatus: "available" as const,
      transferableResourceCount: seed.resourceUnits,
      transferableCardCount: seed.creatureCards,
      reservedCardCount: seed.unavailableCreatureCards,
      pendingCount: response.summary.pendingCount ?? 0
    })
  });
}
