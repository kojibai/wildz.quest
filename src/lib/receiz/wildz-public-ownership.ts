import type { PortableCardAsset } from "../../features/play/portable-card";
import {
  createReceizWildzMarketRepository,
  resolveWildzMarketConditionalAppendRail
} from "./wildz-market-repository";
import {
  currentWildzOwner,
  emptyWildzMarketState,
  type WildzMarketState
} from "./wildz-market-state";

export type WildzPublicOwnershipAuthority = {
  source: "immutable-manifest" | "verified-market";
  state: WildzMarketState;
};

export async function loadVerifiedWildzPublicOwnershipAuthority(
  adapter: unknown
): Promise<WildzPublicOwnershipAuthority> {
  const rail = resolveWildzMarketConditionalAppendRail(adapter);
  if (!rail) {
    return { source: "immutable-manifest", state: emptyWildzMarketState() };
  }

  const loaded = await createReceizWildzMarketRepository({ rail }).load();
  if (loaded.status !== "ready") throw new Error("market_capability_unavailable");
  return { source: "verified-market", state: loaded.state };
}

export function requireCurrentWildzPublicOwner(
  authority: WildzPublicOwnershipAuthority,
  asset: PortableCardAsset,
  actorId: string,
  mismatchError: string
) {
  let currentOwner: string;
  try {
    currentOwner = currentWildzOwner(authority.state, asset);
  } catch {
    throw new Error(mismatchError);
  }
  if (currentOwner !== actorId) throw new Error(mismatchError);
  return currentOwner;
}
