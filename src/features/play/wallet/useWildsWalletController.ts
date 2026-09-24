"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorldOverlayOwner } from "@/features/play/world-overlay-state";
import { createWildsWalletControllerState, gateWildsWalletClientCapabilities, hydrateWildsWalletControllerState, type WildsWalletControllerState, type WildsWalletPage, type WildsWalletReadResponse } from "./wilds-wallet-controller";
import { normalizeWildsWalletPublicUsername } from "@/lib/receiz/wilds-wallet-projections";
import { createWildsWalletControllerDriver, type WildsWalletControllerDriver, wildsWalletSharedSessionCache } from "./wilds-wallet-controller-driver";

import { WildsWalletAuthorizationError } from "./wilds-wallet-authorization-error";

type FetchResponse = Readonly<{ ok: boolean; status: number; json(): Promise<unknown> }>;
export type WildsWalletClientAuthorizationPort = Readonly<{
  authorize(input: Readonly<{ attempt: string; recipientUsername: string; amountPhiMicro: string; rail: "settlement" | "reserve" }>): Promise<Readonly<{ artifact: unknown; challenge: unknown }>>;
}>;
export type WildsWalletReadAuthorizationPort = Readonly<{
  authorize(): Promise<boolean>;
  projectSource?(): Promise<WildsWalletReadResponse | null>;
}>;

export function wildsWalletStatusNeedsIdentityReadAuthority(status: WildsWalletControllerState["status"], transportAuthorityRequired = false) {
  return transportAuthorityRequired || status === "authority-required" || status === "revoked";
}

export function useWildsWalletController(
  identityKey: string,
  authorityGeneration: string,
  options: Readonly<{ authorization?: WildsWalletClientAuthorizationPort; readAuthorization?: WildsWalletReadAuthorizationPort }> = {}
) {
  const [state, setState] = useState<WildsWalletControllerState>(() => hydrateWildsWalletControllerState(identityKey, authorityGeneration, wildsWalletSharedSessionCache));
  const [operationError, setOperationError] = useState<string | null>(null);
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
  const readAuthorityErrorRef = useRef<WildsWalletAuthorizationError | null>(null);
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
  const secureTransferAuthority = useCallback(async () => {
    const current = driver.state;
    if (options.readAuthorization) {
      if (!readAuthorityPromiseRef.current) {
        readAuthorityErrorRef.current = null;
        const operation = options.readAuthorization.authorize().catch((cause: unknown) => {
          readAuthorityErrorRef.current = cause instanceof WildsWalletAuthorizationError ? cause : null;
          return false;
        });
        readAuthorityPromiseRef.current = operation;
        void operation.finally(() => { if (readAuthorityPromiseRef.current === operation) readAuthorityPromiseRef.current = null; });
      }
      if (!await readAuthorityPromiseRef.current) throw readAuthorityErrorRef.current ?? new Error("Wallet connection could not be renewed. Your funds and assets have not moved. Please retry.");
    }
    if (driver.state.identityKey !== current.identityKey || driver.state.authorityGeneration !== current.authorityGeneration) {
      throw new Error("The active account changed. Reopen Send for the current account.");
    }
  }, [driver, options.readAuthorization]);
  const refreshWithIdentityAuthority = useCallback(async (refreshOptions: Readonly<{ replace?: boolean }> = {}) => {
    const expected = { identityKey: driver.state.identityKey, authorityGeneration: driver.state.authorityGeneration };
    await driver.refresh(refreshOptions);
    if (driver.state.identityKey !== expected.identityKey || driver.state.authorityGeneration !== expected.authorityGeneration) return;
    if (!wildsWalletStatusNeedsIdentityReadAuthority(driver.state.status, driver.state.transportAuthorityRequired) || !options.readAuthorization) return;
    if (!readAuthorityPromiseRef.current) {
      readAuthorityErrorRef.current = null;
      const operation = options.readAuthorization.authorize().catch((cause: unknown) => {
        readAuthorityErrorRef.current = cause instanceof WildsWalletAuthorizationError ? cause : null;
        return false;
      });
      readAuthorityPromiseRef.current = operation;
      void operation.finally(() => { if (readAuthorityPromiseRef.current === operation) readAuthorityPromiseRef.current = null; });
    }
    const authorized = await readAuthorityPromiseRef.current;
    if (driver.state.identityKey !== expected.identityKey || driver.state.authorityGeneration !== expected.authorityGeneration) return;
    if (authorized) {
      setOperationError(null);
      await driver.refresh({ replace: true });
    } else if (readAuthorityErrorRef.current) {
      setOperationError(readAuthorityErrorRef.current.message);
    }
  }, [driver, options.readAuthorization]);
  const admitSourceThenRefresh = useCallback(async (refreshOptions: Readonly<{ replace?: boolean }> = {}) => {
    const expected = { identityKey: driver.state.identityKey, authorityGeneration: driver.state.authorityGeneration };
    if (options.readAuthorization?.projectSource && !sourceAuthorityPromiseRef.current) {
      const operation = options.readAuthorization.projectSource()
        .then((response) => { driver.admitSourceAuthority(response, expected); })
        .catch(() => { driver.admitSourceAuthority(null, expected); });
      sourceAuthorityPromiseRef.current = operation;
      void operation.finally(() => { if (sourceAuthorityPromiseRef.current === operation) sourceAuthorityPromiseRef.current = null; });
    }
    await sourceAuthorityPromiseRef.current;
    if (driver.state.identityKey !== expected.identityKey || driver.state.authorityGeneration !== expected.authorityGeneration) return;
    await refreshWithIdentityAuthority(refreshOptions);
  }, [driver, options.readAuthorization, refreshWithIdentityAuthority]);
  useEffect(() => {
    const preloadKey = JSON.stringify([identityKey, authorityGeneration]);
    if (!authorityGeneration || !options.readAuthorization || preloadGenerationRef.current === preloadKey) return;
    const preload = () => {
      // Mark only when the callback actually runs. Effect cleanup can cancel a
      // scheduled preload (including Strict Mode's initial cleanup).
      preloadGenerationRef.current = preloadKey;
      void admitSourceThenRefresh();
    };
    const schedule = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(preload, { timeout: 1_500 })
      : window.setTimeout(preload, 250);
    return () => {
      if (typeof window.cancelIdleCallback === "function" && typeof schedule === "number") window.cancelIdleCallback(schedule);
      else window.clearTimeout(schedule);
    };
  }, [admitSourceThenRefresh, authorityGeneration, identityKey, options.readAuthorization]);
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState !== "visible" || !options.readAuthorization) return;
      const current = driver.state;
      if (current.identityKey !== identityKey || current.authorityGeneration !== authorityGeneration) return;
      if (current.status === "offline-verified" || current.balanceBasis === "saved"
        || wildsWalletStatusNeedsIdentityReadAuthority(current.status, current.transportAuthorityRequired)) {
        void admitSourceThenRefresh({ replace: true });
      }
    };
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [admitSourceThenRefresh, authorityGeneration, driver, identityKey, options.readAuthorization]);
  const openTerminal = useCallback(() => { driver.open(); void admitSourceThenRefresh(); }, [admitSourceThenRefresh, driver]);
  const visible = state.identityKey === identityKey && state.authorityGeneration === authorityGeneration ? state : createWildsWalletControllerState(identityKey, authorityGeneration);
  const capabilities = visible.capabilities
    ? gateWildsWalletClientCapabilities(visible.capabilities, { proofAuthorization: Boolean(options.authorization) })
    : null;
  const lookupRecipient = useCallback((username: string) => {
    // The recipient username is carried by the source-issued proof object.
    // Public lookup may enrich/resolve it, but a missing projection is not a
    // transfer-authority gate.
    if (visible.sourceAuthorityVerified && !visible.capabilities?.recipientLookup.available) {
      try { driver.selectTransferRecipient(normalizeWildsWalletPublicUsername(username)); } catch { /* form remains editable */ }
      return;
    }
    return driver.lookupRecipient(username);
  }, [driver, visible.capabilities?.recipientLookup.available, visible.sourceAuthorityVerified]);
  const stageTransfer = useCallback(async () => {
    setOperationError(null);
    const before = driver.state;
    await refreshWithIdentityAuthority();
    if (driver.state.identityKey !== before.identityKey || driver.state.authorityGeneration !== before.authorityGeneration
      || driver.state.transfer.operationNonce !== before.transfer.operationNonce) return;
    if (driver.state.transportAuthorityRequired) { setOperationError(readAuthorityErrorRef.current?.message ?? "Wallet connection could not be renewed. Please retry."); return; }
    await driver.stageTransfer();
  }, [driver, refreshWithIdentityAuthority]);
  const authorizeTransfer = useCallback(async (pointerId: number) => {
    const authorization = options.authorization;
    const transfer = driver.state.transfer;
    if (!authorization || transfer.phase !== "authorize" || transfer.authorizationPointerId !== pointerId || !transfer.attempt
      || !transfer.recipientUsername || !transfer.amountPhiMicro || !transfer.rail) {
      driver.authorizationPointerCancel(pointerId);
      return;
    }
    setOperationError(null);
    try {
      await secureTransferAuthority();
      const consent = await authorization.authorize({ attempt: transfer.attempt, recipientUsername: transfer.recipientUsername, amountPhiMicro: transfer.amountPhiMicro, rail: transfer.rail });
      await driver.authorizeTransfer(pointerId, consent);
    } catch (cause) {
      setOperationError(cause instanceof WildsWalletAuthorizationError ? cause.message : "Transfer authorization could not be completed. Nothing was sent. Please retry.");
      driver.authorizationPointerCancel(pointerId);
    }
  }, [driver, options.authorization, secureTransferAuthority]);
  return {
    ...visible,
    operationError,
    edgeAuthorityVerified: visible.sourceAuthorityVerified || Boolean(authorityGeneration && options.readAuthorization),
    capabilities,
    openTerminal,
    closeTerminal: driver.close,
    navigate: (page: WildsWalletPage) => driver.navigate(page),
    refresh: admitSourceThenRefresh,
    lookupRecipient,
    selectTransferRecipient: driver.selectTransferRecipient,
    selectReceiveCoordinate: driver.selectReceiveCoordinate,
    reviewTransferAmount: driver.reviewTransferAmount,
    stageTransfer,
    secureTransferAuthority,
    authorizationPointerStart: driver.authorizationPointerStart,
    authorizationPointerCancel: driver.authorizationPointerCancel,
    authorizeTransfer: options.authorization ? authorizeTransfer : null,
    recoverTransfer: driver.recoverTransfer,
    editTransfer(field: "recipient" | "amount") { setOperationError(null); driver.editTransfer(field); },
    resetTransfer() { setOperationError(null); driver.resetTransfer(); },
    expireTransferReview: driver.expireTransferReview,
    requestReceive: driver.requestReceive,
    cancelPending: driver.cancelPending,
    cancelForExclusiveOwner: (owner: WorldOverlayOwner) => driver.cancelForExclusiveOwner(owner)
  };
}
