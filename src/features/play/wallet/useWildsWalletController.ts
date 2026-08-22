"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorldOverlayOwner } from "@/features/play/world-overlay-state";
import { createWildsWalletControllerState, type WildsWalletControllerState, type WildsWalletPage } from "./wilds-wallet-controller";
import { createWildsWalletControllerDriver, type WildsWalletControllerDriver } from "./wilds-wallet-controller-driver";

type FetchResponse = Readonly<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function useWildsWalletController(identityKey: string, authorityGeneration: string) {
  const [state, setState] = useState<WildsWalletControllerState>(() => createWildsWalletControllerState(identityKey, authorityGeneration));
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
  useEffect(() => {
    if (stateRef.current.identityKey !== identityKey || stateRef.current.authorityGeneration !== authorityGeneration) driver.setAuthority(identityKey, authorityGeneration);
  }, [authorityGeneration, driver, identityKey]);
  useEffect(() => () => driver.close(), [driver]);
  useEffect(() => {
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") driver.cancelPending(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [driver]);
  const openTerminal = useCallback(() => { driver.open(); void driver.refresh(); }, [driver]);
  const visible = state.identityKey === identityKey && state.authorityGeneration === authorityGeneration ? state : createWildsWalletControllerState(identityKey, authorityGeneration);
  return {
    ...visible,
    openTerminal,
    closeTerminal: driver.close,
    navigate: (page: WildsWalletPage) => driver.navigate(page),
    refresh: driver.refresh,
    lookupRecipient: driver.recipientUnavailable,
    requestReceive: driver.requestReceive,
    cancelPending: driver.cancelPending,
    cancelForExclusiveOwner: (owner: WorldOverlayOwner) => driver.cancelForExclusiveOwner(owner)
  };
}
