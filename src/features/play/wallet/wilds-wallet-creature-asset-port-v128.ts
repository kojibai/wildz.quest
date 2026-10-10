"use client";

import { receizKaiNow } from "@receiz/sdk";
import type { PortableCardAsset } from "../portable-card";
import type { WildzPreparedIdentityOwnedCard } from "../../../lib/receiz/wildz-identity-adapter";
import type { openWildsResourcePackageExchangeBrowserV128 } from "../../../lib/receiz/wilds-resource-exchange-browser-v128";
import { createWildsWalletBearerGiftController, type WildsWalletBearerGiftControllerInput } from "./wilds-wallet-bearer-gift-controller";
import { assertWildsWalletCreatureGiftSelectionV128, createWildsWalletCreatureBearerProducerV128, verifyWildsWalletBearerGiftOriginV128 } from "./wilds-wallet-bearer-gift-source-v128";
import type { WildsWalletBearerGiftSource } from "./wilds-wallet-bearer-gift-recovery";
import type { WildsWalletBearerGiftLeg } from "./wilds-wallet-bearer-gift-proof";

export type WildsWalletCreatureRuntimeV128 = Awaited<ReturnType<typeof openWildsResourcePackageExchangeBrowserV128>>;
export type WildsWalletCreatureAssetPortInputV128 = Readonly<{
  keyId: string; ownerHandle: string;
  currentIdentity(): Readonly<{keyId:string;ownerHandle:string}>;
  openRuntime(): Promise<WildsWalletCreatureRuntimeV128>;
  card(assetId: string): PortableCardAsset;
  prepareCard(card: PortableCardAsset): Promise<WildzPreparedIdentityOwnedCard>;
  readMessages: WildsWalletBearerGiftControllerInput["readMessages"];
  publish: WildsWalletBearerGiftControllerInput["publish"];
  restoreAccepted?(leg: WildsWalletBearerGiftLeg, source: WildsWalletBearerGiftSource, runtime: WildsWalletCreatureRuntimeV128): Promise<void>;
  onAcceptedOutgoing?(leg: WildsWalletBearerGiftLeg, source: WildsWalletBearerGiftSource, runtime: WildsWalletCreatureRuntimeV128): Promise<void>;
}>;

/** Construction does no work. The runtime, native source and keeper projection
 * are opened only on explicit review/send/accept/check, bound to one identity. */
export function createWildsWalletCreatureAssetPortV128(input: WildsWalletCreatureAssetPortInputV128) {
  let pending: Promise<Readonly<{runtime:WildsWalletCreatureRuntimeV128;producer:ReturnType<typeof createWildsWalletCreatureBearerProducerV128>}>> | undefined;
  let openedRuntime: WildsWalletCreatureRuntimeV128 | undefined;
  const current = () => { const actual = input.currentIdentity(); if(actual.keyId !== input.keyId || actual.ownerHandle !== input.ownerHandle) throw Error("The Explorer changed during this exact creature exchange."); };
  const open = () => {
    current();
    if (openedRuntime && openedRuntime.session.expiresAtKaiUPulse <= receizKaiNow().uPulse) { pending=undefined; openedRuntime=undefined; }
    if (!pending) {
      const operation = (async () => {
        const runtime = await input.openRuntime(); current();
        if(runtime.keyId !== input.keyId || runtime.ownerReceizId !== input.ownerHandle) throw Error("The native source session belongs to another Explorer.");
        openedRuntime=runtime;
        return { runtime, producer: createWildsWalletCreatureBearerProducerV128({ ...input, sdk:runtime.sdk, applicationId:runtime.applicationId, exchange:runtime.exchange }) };
      })();
      pending = operation;
      void operation.catch(() => { if(pending === operation) pending = undefined; });
    }
    return pending;
  };
  return createWildsWalletBearerGiftController({
    ...input, assertSelection:assertWildsWalletCreatureGiftSelectionV128,
    sourceFor: async leg => (await open()).producer.prepare(leg),
    verifyOrigin: async (leg,source) => { const {runtime}=await open(); await verifyWildsWalletBearerGiftOriginV128(leg,source,runtime.sdk,runtime.applicationId); },
    restoreAccepted: async (leg,original,originProof,projectionOriginal) => {
      const {runtime,producer}=await open(), source={original,originProof,projectionOriginal};
      await producer.retainCurrent(source); current();
      if(input.restoreAccepted) await input.restoreAccepted(leg,source,runtime); current();
    },
    onAcceptedOutgoing: async (leg,source) => {
      const {runtime,producer}=await open(); await producer.retainSuccessor(source); current();
      if(input.onAcceptedOutgoing) await input.onAcceptedOutgoing(leg,source,runtime); current();
    },
  });
}
