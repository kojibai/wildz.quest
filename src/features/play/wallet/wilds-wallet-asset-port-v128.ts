"use client";

import { receizKaiNow } from "@receiz/sdk";
import type { openWildsResourcePackageExchangeBrowserV128 } from "../../../lib/receiz/wilds-resource-exchange-browser-v128";
import type { WildsWalletCreatureAssetPortInputV128 } from "./wilds-wallet-creature-asset-port-v128";
import type { createWildsWalletResourceSourceAssetPortV128 } from "./wilds-wallet-resource-source-controller-v128";
import type { WildsWalletStagedTradeAssetPort, WildsWalletStagedTradeLeg } from "./wilds-wallet-staged-trade-types";
import type { WildsWalletAssetSendAsset } from "./wilds-wallet-asset-send";
import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";

type Runtime = Awaited<ReturnType<typeof openWildsResourcePackageExchangeBrowserV128>>;
type ResourceInput = Parameters<typeof createWildsWalletResourceSourceAssetPortV128>[0];
type ResourcePort = ReturnType<typeof createWildsWalletResourceSourceAssetPortV128>;
type AssetLeg = Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>;
export type WildsWalletAssetPortInputV128 = Readonly<
  Pick<WildsWalletCreatureAssetPortInputV128, "keyId" | "ownerHandle" | "currentIdentity" | "card" | "prepareCard" | "readMessages" | "restoreAccepted" | "onAcceptedOutgoing">
  & Pick<ResourceInput, "flushGameplay" | "readKai" | "onProjection">
  & { gameplayOwnerId: string; publishCreature: WildsWalletCreatureAssetPortInputV128["publish"]; publishResource: ResourceInput["publish"] }
>;

/** No enrollment, crypto, network or source reads occur during construction.
 * Each operation keeps its identity and exact durable source across recovery. */
export function createWildsWalletAssetPortV128(input: WildsWalletAssetPortInputV128) {
  let runtime: Runtime | null = null, opening: Promise<Runtime> | null = null;
  const assertCurrent = () => {
    const current = input.currentIdentity();
    if (current.keyId !== input.keyId || current.ownerHandle !== input.ownerHandle) throw Error("The Explorer changed. Reopen this exact wallet action.");
  };
  const openRuntime = async (): Promise<Runtime> => {
    assertCurrent();
    if (runtime && runtime.session.expiresAtKaiUPulse > receizKaiNow().uPulse) return runtime;
    if (!opening) {
      const operation = (async () => {
        const { openWildsResourcePackageExchangeBrowserV128 } = await import("../../../lib/receiz/wilds-resource-exchange-browser-v128");
        const opened = await openWildsResourcePackageExchangeBrowserV128({ keyId: input.keyId, gameplayOwnerId: input.gameplayOwnerId,
          resolveOriginal: async card => {
            assertCurrent();
            const prepared = await input.prepareCard(card);
            const current = await openRuntime();
            const { prepareWildsWalletSafeHeldCardSourceV128 } = await import("./wilds-wallet-bearer-gift-source-v128");
            const original = await prepareWildsWalletSafeHeldCardSourceV128({ sdk: current.sdk, card, prepared, keyId: input.keyId, ownerHandle: input.ownerHandle });
            assertCurrent(); return original;
          } });
        assertCurrent();
        if (opened.keyId !== input.keyId || opened.ownerReceizId !== input.ownerHandle) throw Error("The source session belongs to another Explorer.");
        runtime = opened; return opened;
      })();
      opening = operation;
      void operation.finally(() => { if (opening === operation) opening = null; }).catch(() => undefined);
    }
    return opening;
  };
  let ports: Promise<Readonly<{ creature: ReturnType<typeof import("./wilds-wallet-creature-asset-port-v128")["createWildsWalletCreatureAssetPortV128"]>; resource: ResourcePort }>> | null = null;
  const loadPorts = () => {
    assertCurrent();
    if (!ports) ports = Promise.all([import("./wilds-wallet-creature-asset-port-v128"), import("./wilds-wallet-resource-source-controller-v128")]).then(([creature, resource]) => ({
      creature: creature.createWildsWalletCreatureAssetPortV128({ ...input, openRuntime, publish: input.publishCreature }),
      resource: resource.createWildsWalletResourceSourceAssetPortV128({ ...input, openRuntime, publish: input.publishResource })
    }));
    const loading = ports;
    void loading.catch(() => { if (ports === loading) ports = null; });
    return loading;
  };
  const forLeg = async (leg: AssetLeg) => { const current = await loadPorts(); assertCurrent(); return leg.request.asset.kind === "creature" ? current.creature : current.resource; };
  const port: WildsWalletStagedTradeAssetPort = {
    prepareSource: async leg => (await forLeg(leg)).prepareSource(leg),
    sendSource: async (leg, descriptor, authority) => (await forLeg(leg)).sendSource(leg, descriptor, authority),
    observeSource: async (leg, descriptor, locator, authority) => (await forLeg(leg)).observeSource(leg, descriptor, locator, authority),
    verifyAccepted: async (leg, descriptor, outcome, authority) => { await (await forLeg(leg)).verifyAccepted(leg, descriptor, outcome, authority); assertCurrent(); },
    acceptSource: async (leg, descriptor, authority) => {
      const current = await forLeg(leg);
      if (!current.acceptSource) throw Error("This exact asset has no recipient acceptance path.");
      return current.acceptSource(leg, descriptor, authority);
    }
  };
  return { ...port, openRuntime,
    qualifyListing: async (asset: WildsWalletAssetSendAsset, summary?: string) => {
      assertCurrent();
      await input.flushGameplay(); assertCurrent();
      if (asset.kind === "creature") return (await loadPorts()).creature.qualifyListing(asset, summary);
      const { qualifyWildzMarketResourceSelectionV128 } = await import("../../../lib/receiz/wildz-market-resource-selection-v128");
      const runtime = await openRuntime(); assertCurrent();
      const selection = await qualifyWildzMarketResourceSelectionV128({runtime, asset, summary: summary?.trim() || "Resource package",
        attemptId: `market-selection:${sha256PortableBasis(canonicalPortableCardJson({ownerHandle: input.ownerHandle, asset})).replace(/^sha256:/, "")}`});
      assertCurrent(); return selection;
    },
    unpackHeldPackage: async (packageId: string) => (await loadPorts()).resource.unpackHeldPackage(packageId), unpackReceivedPackage: async (...args: Parameters<ResourcePort["unpackReceivedPackage"]>) => (await loadPorts()).resource.unpackReceivedPackage(...args) };
}
