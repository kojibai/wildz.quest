"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { WorldOverlayOwner } from "@/features/play/world-overlay-state";
import {
  admitWildsWalletReadResponse,
  classifyWildsWalletRefreshFailure,
  createWildsWalletRequestRuntime,
  createWildsWalletSessionCache,
  hydrateWildsWalletControllerState,
  reduceWildsWalletController,
  walletAuthorityCacheKey,
  type WildsWalletControllerEvent,
  type WildsWalletPage
} from "./wilds-wallet-controller";

const verifiedWalletCache = createWildsWalletSessionCache(4);

type WalletHttpFailure = Readonly<{ status: number | null; code: string | null }>;

async function readJson(response: Response) {
  const value = await response.json().catch(() => null) as unknown;
  if (response.ok) return value;
  const code = value && typeof value === "object" && !Array.isArray(value) && typeof (value as { error?: unknown }).error === "string"
    ? (value as { error: string }).error : null;
  throw { status: response.status, code } satisfies WalletHttpFailure;
}

export function useWildsWalletController(identityKey: string, authorityGeneration: string) {
  const [state, dispatch] = useReducer(
    reduceWildsWalletController,
    { identityKey, authorityGeneration },
    ({ identityKey: initialIdentity, authorityGeneration: initialGeneration }) => hydrateWildsWalletControllerState(initialIdentity, initialGeneration, verifiedWalletCache)
  );
  const stateRef = useRef(state);
  const runtimeRef = useRef(createWildsWalletRequestRuntime());
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const receivePromiseRef = useRef<Promise<void> | null>(null);
  const publish = useCallback((event: WildsWalletControllerEvent) => {
    stateRef.current = reduceWildsWalletController(stateRef.current, event);
    runtimeRef.current.recordPublication();
    dispatch(event);
  }, []);
  const cancelPending = useCallback(() => {
    runtimeRef.current.cancelAll();
    refreshPromiseRef.current = null;
    receivePromiseRef.current = null;
    publish({ type: "cancel-pending" });
  }, [publish]);

  useEffect(() => {
    const current = stateRef.current;
    if (current.identityKey === identityKey && current.authorityGeneration === authorityGeneration) return;
    runtimeRef.current.cancelAll();
    refreshPromiseRef.current = null;
    receivePromiseRef.current = null;
    verifiedWalletCache.delete(walletAuthorityCacheKey(current.identityKey, current.authorityGeneration));
    publish({ type: "identity-invalidated", identityKey, authorityGeneration });
  }, [authorityGeneration, identityKey, publish]);
  useEffect(() => () => runtimeRef.current.cancelAll(), []);
  useEffect(() => {
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") cancelPending(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [cancelPending]);

  const refresh = useCallback((options: Readonly<{ replace?: boolean }> = {}) => {
    if (!options.replace && refreshPromiseRef.current) return refreshPromiseRef.current;
    const request = runtimeRef.current.beginRefresh(options);
    if (!request) return refreshPromiseRef.current ?? Promise.resolve();
    const identityAtStart = stateRef.current.identityKey;
    const generationAtStart = stateRef.current.authorityGeneration;
    publish({ type: "refresh-start", requestId: request.id });
    const operation = (async () => {
      try {
        const [summary, capabilities, ledger] = await Promise.all([
          fetch("/api/wilds/wallet/summary", { cache: "no-store", credentials: "same-origin", signal: request.controller.signal }).then(readJson),
          fetch("/api/wilds/wallet/capabilities", { cache: "no-store", credentials: "same-origin", signal: request.controller.signal }).then(readJson),
          fetch("/api/wilds/wallet/ledger", { cache: "no-store", credentials: "same-origin", signal: request.controller.signal }).then(readJson)
        ]);
        if (!runtimeRef.current.isCurrentRefresh(request.id) || request.controller.signal.aborted) return;
        const response = admitWildsWalletReadResponse({ summary, capabilities, ledger });
        verifiedWalletCache.write(walletAuthorityCacheKey(identityAtStart, generationAtStart), response);
        runtimeRef.current.recordCacheWrite();
        publish({ type: "refresh-resolved", requestId: request.id, identityKey: identityAtStart, authorityGeneration: generationAtStart, response });
      } catch (cause) {
        if (!runtimeRef.current.isCurrentRefresh(request.id) || request.controller.signal.aborted) return;
        const failure = cause && typeof cause === "object" && "status" in cause
          ? cause as WalletHttpFailure : { status: null, code: null };
        const reason = classifyWildsWalletRefreshFailure(failure);
        if (reason === "revoked") verifiedWalletCache.delete(walletAuthorityCacheKey(identityAtStart, generationAtStart));
        publish({ type: "refresh-failed", requestId: request.id, reason });
      } finally {
        runtimeRef.current.finishRefresh(request.id);
      }
    })();
    refreshPromiseRef.current = operation;
    void operation.finally(() => { if (refreshPromiseRef.current === operation) refreshPromiseRef.current = null; });
    return operation;
  }, [publish]);
  const open = useCallback(() => { publish({ type: "open" }); void refresh(); }, [publish, refresh]);
  const close = useCallback(() => { runtimeRef.current.cancelAll(); refreshPromiseRef.current = null; receivePromiseRef.current = null; publish({ type: "close" }); }, [publish]);
  const cancelForExclusiveOwner = useCallback((owner: WorldOverlayOwner) => {
    if (owner === "none" || owner === "wallet") return;
    runtimeRef.current.cancelAll();
    refreshPromiseRef.current = null;
    receivePromiseRef.current = null;
    publish({ type: "exclusive-owner-changed", owner });
  }, [publish]);
  const navigate = useCallback((page: WildsWalletPage) => publish({ type: "navigate", page }), [publish]);
  const lookupRecipient = useCallback((username: string) => publish({ type: "recipient-lookup-unavailable", username }), [publish]);
  const requestReceive = useCallback((amountPhiMicro?: string) => {
    if (receivePromiseRef.current) return receivePromiseRef.current;
    const request = runtimeRef.current.beginReceive();
    if (!request) return receivePromiseRef.current ?? Promise.resolve();
    const identityAtStart = stateRef.current.identityKey;
    publish({ type: "receive-request-start", requestId: request.id, identityKey: identityAtStart });
    const operation = (async () => {
      try {
        const value = await fetch("/api/wilds/wallet/request", { method: "POST", cache: "no-store", credentials: "same-origin", signal: request.controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify(amountPhiMicro ? { amountPhiMicro } : {}) }).then(readJson);
        if (!runtimeRef.current.isCurrentReceive(request.id) || request.controller.signal.aborted || !value || typeof value !== "object" || Array.isArray(value) || typeof (value as { locator?: unknown }).locator !== "string") return;
        publish({ type: "receive-request-resolved", requestId: request.id, identityKey: identityAtStart, locator: (value as { locator: string }).locator });
      } catch {
        if (runtimeRef.current.isCurrentReceive(request.id) && !request.controller.signal.aborted) publish({ type: "receive-request-cleared" });
      } finally {
        runtimeRef.current.finishReceive(request.id);
      }
    })();
    receivePromiseRef.current = operation;
    void operation.finally(() => { if (receivePromiseRef.current === operation) receivePromiseRef.current = null; });
    return operation;
  }, [publish]);
  const visible = state.identityKey === identityKey && state.authorityGeneration === authorityGeneration
    ? state : hydrateWildsWalletControllerState(identityKey, authorityGeneration, verifiedWalletCache);
  return { ...visible, openTerminal: open, closeTerminal: close, navigate, refresh, lookupRecipient, requestReceive, cancelPending, cancelForExclusiveOwner };
}
