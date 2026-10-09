"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createWildsWalletControllerState, gateWildsWalletClientCapabilities, hydrateWildsWalletControllerState, renewWildsWalletControllerState, type WildsWalletControllerState, type WildsWalletPage, type WildsWalletReadResponse } from "./wilds-wallet-controller";
import { createWildsWalletControllerDriver, type WildsWalletControllerDriver, wildsWalletSharedSessionCache } from "./wilds-wallet-controller-driver";

import { WildsWalletAuthorizationError } from "./wilds-wallet-authorization-error";
import { wildzGameplayBackground } from "@/lib/performance/wildz-gameplay-background";

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
  options: Readonly<{ authorization?: WildsWalletClientAuthorizationPort; readAuthorization?: WildsWalletReadAuthorizationPort; backgroundReady?: boolean; sourceKey?: string }> = {}
) {
  const sourceKey = options.sourceKey ?? authorityGeneration;
  const [state, setState] = useState<WildsWalletControllerState>(() => hydrateWildsWalletControllerState(identityKey, authorityGeneration, wildsWalletSharedSessionCache));
  const [operationError, setOperationError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const driverRef = useRef<WildsWalletControllerDriver | null>(null);
  if (!driverRef.current) {
    driverRef.current = createWildsWalletControllerDriver({
      identityKey,
      authorityGeneration,
      sourceKey,
      fetcher: (path, init) => fetch(path, { ...init, cache: "no-store", credentials: "same-origin", headers: init.method === "POST" ? { "content-type": "application/json" } : undefined }) as Promise<FetchResponse>,
      publish(next) { stateRef.current = next; setState(next); }
    });
    stateRef.current = driverRef.current.state;
  }
  const driver = driverRef.current;
  const readAuthorityErrorRef = useRef<WildsWalletAuthorizationError | null>(null);
  const readAuthorityPromiseRef = useRef<Promise<boolean> | null>(null);
  const backgroundReady = options.backgroundReady ?? true;
  const preloadGenerationRef = useRef("");
  useEffect(() => {
    if (stateRef.current.identityKey !== identityKey || stateRef.current.authorityGeneration !== authorityGeneration || driver.sourceKey !== sourceKey) {
      readAuthorityPromiseRef.current = null;
      readAuthorityErrorRef.current = null;
      setOperationError(null);
      driver.setAuthority(identityKey, authorityGeneration, sourceKey);
    }
  }, [authorityGeneration, driver, identityKey, sourceKey]);
  useEffect(() => () => driver.dispose(), [driver]);
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
    } else {
      setOperationError(readAuthorityErrorRef.current?.message ?? "Wallet connection could not be renewed. Please retry.");
    }
  }, [driver, options.readAuthorization]);
  const admitSourceThenRefresh = useCallback(async (refreshOptions: Readonly<{ replace?: boolean }> = {}) => {
    const expected = { identityKey: driver.state.identityKey, authorityGeneration: driver.state.authorityGeneration };
    const authorization = options.readAuthorization;
    if (authorization?.projectSource) {
      void driver.projectSourceAuthority(() => authorization.projectSource!())
        .catch(() => { /* Failed projection grants no source authority; retry the read below. */ });
    }
    // Saved identity projection enriches the view independently. It must not
    // hold the live balance request behind a large imported proof archive.
    if (driver.state.identityKey !== expected.identityKey || driver.state.authorityGeneration !== expected.authorityGeneration) return;
    await refreshWithIdentityAuthority(refreshOptions);
  }, [driver, options.readAuthorization, refreshWithIdentityAuthority]);
  useEffect(() => {
    if (!backgroundReady) return;
    const preloadKey = JSON.stringify([identityKey, authorityGeneration, sourceKey]);
    if (!authorityGeneration || !options.readAuthorization || preloadGenerationRef.current === preloadKey) return;
    let disposed = false;
    const preload = () => {
      if (disposed || document.visibilityState !== "visible") return;
      // Mark only when the callback actually runs. Effect cleanup can cancel a
      // scheduled preload (including Strict Mode's initial cleanup).
      preloadGenerationRef.current = preloadKey;
      void admitSourceThenRefresh();
    };
    void wildzGameplayBackground.run(preload, { timeoutMs: 1_500 }).catch(() => undefined);
    return () => { disposed = true; };
  }, [backgroundReady, admitSourceThenRefresh, authorityGeneration, identityKey, options.readAuthorization, sourceKey]);
  useEffect(() => {
    if (!backgroundReady) return;
    let disposed = false;
    const resume = () => {
      if (document.visibilityState !== "visible" || !options.readAuthorization) return;
      void wildzGameplayBackground.run(() => {
        if (disposed || document.visibilityState !== "visible") return;
        const current = driver.state;
        if (current.identityKey !== identityKey || current.authorityGeneration !== authorityGeneration) return;
        if (current.status !== "verified" || current.balanceBasis === "saved"
          || wildsWalletStatusNeedsIdentityReadAuthority(current.status, current.transportAuthorityRequired)) {
          return admitSourceThenRefresh({ replace: true });
        }
      }).catch(() => undefined);
    };
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [backgroundReady, admitSourceThenRefresh, authorityGeneration, driver, identityKey, options.readAuthorization]);
  // Retry read-only work after cancellation or transient failure, even when the
  // terminal is closed and only the world HUD needs the balance.
  useEffect(() => {
    if (!backgroundReady) return;
    if (!authorityGeneration || !options.readAuthorization) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const retry = async () => {
      if (disposed) return;
      await wildzGameplayBackground.run(async () => {
        if (disposed) return;
        if (document.visibilityState === "visible" && navigator.onLine !== false
          && driver.state.status !== "verified" && driver.state.requestId === null) {
          await admitSourceThenRefresh();
          failures = (driver.state as WildsWalletControllerState).status === "verified" ? 0 : failures + 1;
        }
      }).catch(() => undefined);
      if (!disposed) timer = setTimeout(retry, Math.min(30_000, 2_000 * 2 ** Math.min(failures, 4)));
    };
    timer = setTimeout(retry, 2_000);
    return () => { disposed = true; clearTimeout(timer); };
  }, [backgroundReady, admitSourceThenRefresh, authorityGeneration, driver, options.readAuthorization]);
  const openTerminal = useCallback(() => { driver.open(); void admitSourceThenRefresh(); }, [admitSourceThenRefresh, driver]);
  const visible = state.identityKey === identityKey && state.authorityGeneration === authorityGeneration ? state
    : renewWildsWalletControllerState(state, createWildsWalletControllerState(identityKey, authorityGeneration));
  const capabilities = visible.capabilities
    ? gateWildsWalletClientCapabilities(visible.capabilities, { proofAuthorization: Boolean(options.authorization) })
    : null;
  const lookupRecipient = useCallback((username: string) => {
    return driver.lookupRecipient(username);
  }, [driver]);
  const stageTransfer = useCallback(async () => {
    setOperationError(null);
    const before = driver.state;
    // Preview already verifies live balance, heads and scopes. A second full
    // wallet read would add three requests without strengthening that boundary.
    if (wildsWalletStatusNeedsIdentityReadAuthority(before.status, before.transportAuthorityRequired)) await refreshWithIdentityAuthority();
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
      await driver.signAndAuthorizeTransfer(pointerId, async (reviewed) => {
        if (wildsWalletStatusNeedsIdentityReadAuthority(driver.state.status, driver.state.transportAuthorityRequired)) await secureTransferAuthority();
        if (driver.state.transfer.phase !== "signing" || driver.state.transfer.attempt !== reviewed.attempt) throw new Error("wilds_wallet_transfer_review_changed");
        return authorization.authorize({ attempt: reviewed.attempt!, recipientUsername: reviewed.recipientUsername!, amountPhiMicro: reviewed.amountPhiMicro!, rail: reviewed.rail! });
      });
    } catch (cause) {
      setOperationError(cause instanceof WildsWalletAuthorizationError ? cause.message : "Transfer authorization could not be completed. Nothing was sent. Please retry.");
      driver.authorizationPointerCancel(pointerId);
    }
  }, [driver, options.authorization, secureTransferAuthority]);
  const recoverTransfer = useCallback(async () => {
    setOperationError(null);
    try {
      await secureTransferAuthority();
      await driver.recoverTransfer();
    } catch (cause) {
      setOperationError(cause instanceof WildsWalletAuthorizationError ? cause.message : "Payment status could not be checked. Reconnect and try again; this will not send another payment.");
    }
  }, [driver, secureTransferAuthority]);
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
    recoverTransfer,
    editTransfer(field: "recipient" | "amount") { setOperationError(null); driver.editTransfer(field); },
    resetTransfer() { setOperationError(null); driver.resetTransfer(); },
    expireTransferReview: driver.expireTransferReview,
    requestReceive: driver.requestReceive,
    cancelPending: driver.cancelPending,
    cancelForExclusiveOwner: driver.cancelForExclusiveOwner
  };
}
