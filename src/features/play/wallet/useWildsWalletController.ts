"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorldOverlayOwner } from "@/features/play/world-overlay-state";
import { createWildsWalletControllerState, gateWildsWalletClientCapabilities, hydrateWildsWalletControllerState, type WildsWalletControllerState, type WildsWalletPage, type WildsWalletReadResponse } from "./wilds-wallet-controller";
import { createWildsWalletControllerDriver, type WildsWalletControllerDriver, wildsWalletSharedSessionCache } from "./wilds-wallet-controller-driver";

type FetchResponse = Readonly<{ ok: boolean; status: number; json(): Promise<unknown> }>;
export type WildsWalletClientAuthorizationPort = Readonly<{
  authorize(input: Readonly<{ attempt: string; recipientUsername: string; amountPhiMicro: string; rail: "settlement" | "reserve" }>): Promise<Readonly<{ artifact: unknown; challenge: unknown }>>;
}>;
export type WildsWalletReadAuthorizationPort = Readonly<{
  authorize(): Promise<boolean>;
  projectSource?(): Promise<WildsWalletReadResponse | null>;
}>;

export function wildsWalletStatusNeedsIdentityReadAuthority(status: WildsWalletControllerState["status"]) {
  return status === "authority-required" || status === "revoked";
}

export function useWildsWalletController(
  identityKey: string,
  authorityGeneration: string,
  options: Readonly<{ authorization?: WildsWalletClientAuthorizationPort; readAuthorization?: WildsWalletReadAuthorizationPort }> = {}
) {
  const [state, setState] = useState<WildsWalletControllerState>(() => hydrateWildsWalletControllerState(identityKey, authorityGeneration, wildsWalletSharedSessionCache));
  const stateRef = useRef(state);
  const driverRef = useRef<WildsWalletControllerDriver | null>(null);
  if (!driverRef.current) {
    driverRef.current = createWildsWalletControllerDriver({
      identityKey,
      authorityGeneration,
      fetcher: (path, init) => fetch(path, { ...init, cache: "no-store", credentials: "same-origin", headers: init.method === "POST" ? { "content-type": "application/json" } : undefined }) as Promise<FetchResponse>,
      publish(next) { stateRef.current = next; setState(next); }
    });
    stateRef.current = driverRef.current.state;
  }
  const driver = driverRef.current;
  const readAuthorityPromiseRef = useRef<Promise<boolean> | null>(null);
  const sourceAuthorityPromiseRef = useRef<Promise<void> | null>(null);
  const preloadGenerationRef = useRef("");
  useEffect(() => {
    if (stateRef.current.identityKey !== identityKey || stateRef.current.authorityGeneration !== authorityGeneration) driver.setAuthority(identityKey, authorityGeneration);
  }, [authorityGeneration, driver, identityKey]);
  useEffect(() => () => driver.close(), [driver]);
  useEffect(() => {
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") driver.cancelPending(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [driver]);
  const refreshWithIdentityAuthority = useCallback(async () => {
    await driver.refresh();
    if (!wildsWalletStatusNeedsIdentityReadAuthority(driver.state.status) || !options.readAuthorization) return;
    if (!readAuthorityPromiseRef.current) {
      const operation = options.readAuthorization.authorize().catch(() => false);
      readAuthorityPromiseRef.current = operation;
      void operation.finally(() => { if (readAuthorityPromiseRef.current === operation) readAuthorityPromiseRef.current = null; });
    }
    if (await readAuthorityPromiseRef.current) await driver.refresh({ replace: true });
  }, [driver, options.readAuthorization]);
  const admitSourceThenRefresh = useCallback(async () => {
    if (options.readAuthorization?.projectSource && !sourceAuthorityPromiseRef.current) {
      const operation = options.readAuthorization.projectSource()
        .then((response) => { driver.admitSourceAuthority(response); })
        .catch(() => { driver.admitSourceAuthority(null); });
      sourceAuthorityPromiseRef.current = operation;
      void operation.finally(() => { if (sourceAuthorityPromiseRef.current === operation) sourceAuthorityPromiseRef.current = null; });
    }
    await sourceAuthorityPromiseRef.current;
    await refreshWithIdentityAuthority();
  }, [driver, options.readAuthorization, refreshWithIdentityAuthority]);
  useEffect(() => {
    if (!authorityGeneration || !options.readAuthorization || preloadGenerationRef.current === authorityGeneration) return;
    preloadGenerationRef.current = authorityGeneration;
    const schedule = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(() => { void admitSourceThenRefresh(); }, { timeout: 1_500 })
      : window.setTimeout(() => { void admitSourceThenRefresh(); }, 250);
    return () => {
      if (typeof window.cancelIdleCallback === "function" && typeof schedule === "number") window.cancelIdleCallback(schedule);
      else window.clearTimeout(schedule);
    };
  }, [admitSourceThenRefresh, authorityGeneration, options.readAuthorization]);
  const openTerminal = useCallback(() => { driver.open(); void admitSourceThenRefresh(); }, [admitSourceThenRefresh, driver]);
  const visible = state.identityKey === identityKey && state.authorityGeneration === authorityGeneration ? state : createWildsWalletControllerState(identityKey, authorityGeneration);
  const capabilities = visible.capabilities
    ? gateWildsWalletClientCapabilities(visible.capabilities, { proofAuthorization: Boolean(options.authorization) })
    : null;
  const authorizeTransfer = useCallback(async (pointerId: number) => {
    const authorization = options.authorization;
    const transfer = driver.state.transfer;
    if (!authorization || transfer.phase !== "authorize" || transfer.authorizationPointerId !== pointerId || !transfer.attempt
      || !transfer.recipientUsername || !transfer.amountPhiMicro || !transfer.rail) {
      driver.authorizationPointerCancel(pointerId);
      return;
    }
    try {
      const consent = await authorization.authorize({ attempt: transfer.attempt, recipientUsername: transfer.recipientUsername, amountPhiMicro: transfer.amountPhiMicro, rail: transfer.rail });
      await driver.authorizeTransfer(pointerId, consent);
    } catch {
      driver.authorizationPointerCancel(pointerId);
    }
  }, [driver, options.authorization]);
  return {
    ...visible,
    edgeAuthorityVerified: visible.sourceAuthorityVerified || Boolean(authorityGeneration && options.readAuthorization),
    capabilities,
    openTerminal,
    closeTerminal: driver.close,
    navigate: (page: WildsWalletPage) => driver.navigate(page),
    refresh: admitSourceThenRefresh,
    lookupRecipient: driver.lookupRecipient,
    selectTransferRecipient: driver.selectTransferRecipient,
    reviewTransferAmount: driver.reviewTransferAmount,
    stageTransfer: driver.stageTransfer,
    authorizationPointerStart: driver.authorizationPointerStart,
    authorizationPointerCancel: driver.authorizationPointerCancel,
    authorizeTransfer: options.authorization ? authorizeTransfer : null,
    recoverTransfer: driver.recoverTransfer,
    resetTransfer: driver.resetTransfer,
    expireTransferReview: driver.expireTransferReview,
    requestReceive: driver.requestReceive,
    cancelPending: driver.cancelPending,
    cancelForExclusiveOwner: (owner: WorldOverlayOwner) => driver.cancelForExclusiveOwner(owner)
  };
}
