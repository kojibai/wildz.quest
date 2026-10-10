"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createWildsWalletStagedTradeAdapter, type WildsWalletStagedTradeAdapterInput } from "./wilds-wallet-staged-trade-adapter";
import type { WildsWalletTradeAgreement, WildsWalletTradeExchangeResult } from "./wilds-wallet-trade";
import type { WildsWalletStagedTradeResult, WildsWalletStagedTradeIncomingAsset } from "./wilds-wallet-staged-trade-types";
import { parseWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";

type HookInput = Omit<WildsWalletStagedTradeAdapterInput, "keyId" | "ownerHandle" | "currentIdentity"> & Readonly<{
  keyId: string | null | undefined; ownerHandle: string | null | undefined;
  currentIdentity(): Readonly<{ keyId: string | null | undefined; ownerHandle: string | null | undefined }>;
}>;
const unavailable = (): WildsWalletStagedTradeResult => ({ status: "failed", message: "Unlock a verified Explorer identity before approving this staged trade." });

/** No startup network, proof refresh or sealer enrollment. The caller supplies
 * the existing messenger and baseline asset-send callbacks. */
export function useWildsWalletStagedTrade(input: HookInput) {
  const live = useRef(input); live.current = input;
  const { keyId, ownerHandle } = input;
  const [state, setState] = useState<{ key: string | null | undefined; owner: string | null | undefined; result: WildsWalletStagedTradeResult | null; incomingAssets: readonly WildsWalletStagedTradeIncomingAsset[]; pending: number }>({ key: input.keyId, owner: input.ownerHandle, result: null, incomingAssets: [], pending: 0 });
  const adapter = useMemo(() => {
    if (typeof keyId !== "string" || !/^[a-f0-9]{64}$/.test(keyId) || typeof ownerHandle !== "string" || parseWildzPlayerCoordinate(ownerHandle)?.profileHandle !== ownerHandle) return null;
    return createWildsWalletStagedTradeAdapter({ keyId, ownerHandle,
    recoveryStore: live.current.recoveryStore, phi: live.current.phi,
    fetcher: (url, options) => (live.current.fetcher ?? fetch)(url, options),
    loadIdentityOriginal: live.current.loadIdentityOriginal,
    currentIdentity: () => {
      const current = live.current.currentIdentity();
      if (!current.keyId || !current.ownerHandle) throw Error("Unlock a verified Explorer before continuing this trade.");
      return { keyId: current.keyId, ownerHandle: current.ownerHandle };
    },
    sendWalletAsset: request => live.current.sendWalletAsset(request),
    assetPort: {
      prepareSource: leg => live.current.assetPort.prepareSource(leg),
      sendSource: (leg, descriptor, authority) => live.current.assetPort.sendSource(leg, descriptor, authority),
      observeSource: (leg, descriptor, locator, authority) => live.current.assetPort.observeSource(leg, descriptor, locator, authority),
      verifyAccepted: (leg, descriptor, outcome, authority) => live.current.assetPort.verifyAccepted(leg, descriptor, outcome, authority),
      acceptSource: (leg, descriptor, authority) => {
        const action = live.current.assetPort.acceptSource;
        if (!action) throw Error("Acceptance is unavailable for this asset source.");
        return action(leg, descriptor, authority);
      },
    },
    readConversations: () => live.current.readConversations(),
    publish: (message, peer) => live.current.publish(message, peer),
    ensureReady: () => live.current.ensureReady?.() ?? Promise.resolve(),
  }); }, [keyId, ownerHandle]);
  const run = useCallback(async (action: () => Promise<WildsWalletStagedTradeResult>) => {
    const key = live.current.keyId, owner = live.current.ownerHandle;
    setState(previous => ({ key, owner, result: previous.key === key && previous.owner === owner ? previous.result : null, incomingAssets: previous.key === key && previous.owner === owner ? previous.incomingAssets : [], pending: previous.key === key && previous.owner === owner ? previous.pending + 1 : 1 }));
    try {
      const next = await action();
      const incomingAssets = live.current.assetPort.acceptSource ? await adapter?.incomingAssets().catch(() => []) ?? [] : [];
      if (live.current.keyId === key && live.current.ownerHandle === owner) setState(previous => previous.key === key && previous.owner === owner ? { ...previous, result: next, incomingAssets } : previous);
      return next;
    } finally { setState(previous => previous.key === key && previous.owner === owner ? { ...previous, pending: Math.max(0, previous.pending - 1) } : previous); }
  }, [adapter]);
  const currentState = state.key === input.keyId && state.owner === input.ownerHandle;
  return {
    result: currentState ? state.result : null, busy: currentState && state.pending > 0,
    available: !!adapter,
    incomingAssets: currentState && adapter ? state.incomingAssets : [],
    approve: useCallback((agreement: WildsWalletTradeAgreement) => run(() => adapter?.approve(agreement) ?? Promise.resolve(unavailable())), [adapter, run]),
    resume: useCallback((agreement: WildsWalletTradeAgreement) => run(() => adapter?.resume(agreement) ?? Promise.resolve(unavailable())), [adapter, run]),
    receive: useCallback((message: unknown, senderHandle: string) => run(() => adapter?.receive(message, senderHandle) ?? Promise.resolve(unavailable())), [adapter, run]),
    acceptIncomingAsset: useCallback((legId: string) => run(() => adapter?.acceptIncomingAsset(legId) ?? Promise.resolve(unavailable())), [adapter, run]),
    onAcceptIncomingAsset: useCallback(async (legId: string): Promise<WildsWalletTradeExchangeResult> => {
      const next = await run(() => adapter?.acceptIncomingAsset(legId) ?? Promise.resolve(unavailable()));
      return { ...next, status: next.status === "completed" ? "committed" : next.status === "awaiting-acceptance" ? "awaiting-peer" : next.status };
    }, [adapter, run]),
    onApproveTrade: useCallback(async (agreement: WildsWalletTradeAgreement): Promise<WildsWalletTradeExchangeResult> => {
      const next = await run(() => adapter?.approve(agreement) ?? Promise.resolve(unavailable()));
      return { ...next, status: next.status === "completed" ? "committed" : next.status === "awaiting-acceptance" ? "awaiting-peer" : next.status };
    }, [adapter, run]),
    onRecoverTrade: useCallback(async (agreement: WildsWalletTradeAgreement): Promise<WildsWalletTradeExchangeResult> => {
      const next = await run(() => adapter?.resume(agreement) ?? Promise.resolve(unavailable()));
      return { ...next, status: next.status === "completed" ? "committed" : next.status === "awaiting-acceptance" ? "awaiting-peer" : next.status };
    }, [adapter, run]),
  };
}
