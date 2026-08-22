"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { WalletCapabilityProjection, WalletLedgerPageProjection, WalletSummaryProjection } from "@/lib/receiz/wilds-wallet-projections";
import {
  classifyWildsWalletRefreshFailure,
  createWildsWalletControllerState,
  reduceWildsWalletController,
  type WildsWalletControllerState,
  type WildsWalletPage
} from "./wilds-wallet-controller";

type WalletReadResponse = Readonly<{
  summary: WalletSummaryProjection;
  capabilities: WalletCapabilityProjection;
  ledger: WalletLedgerPageProjection | null;
}>;

const verifiedWalletCache = new Map<string, WalletReadResponse>();

function initialState(identityKey: string) {
  const cached = verifiedWalletCache.get(identityKey);
  if (!cached) return createWildsWalletControllerState(identityKey);
  return {
    ...createWildsWalletControllerState(identityKey),
    status: "verified" as const,
    summary: cached.summary,
    capabilities: cached.capabilities,
    ledger: cached.ledger
  };
}

async function readJson(response: Response) {
  if (!response.ok) throw Object.assign(new Error("wilds_wallet_request_failed"), { status: response.status });
  return response.json() as Promise<unknown>;
}

function isSummary(value: unknown): value is WalletSummaryProjection {
  return Boolean(value && typeof value === "object" && (value as { status?: unknown }).status === "verified"
    && typeof (value as { admittedPhiMicro?: unknown }).admittedPhiMicro === "string");
}

function isCapabilities(value: unknown): value is WalletCapabilityProjection {
  return Boolean(value && typeof value === "object" && (value as { read?: unknown }).read === "available"
    && (value as { send?: { available?: unknown } }).send?.available === false);
}

function isLedger(value: unknown): value is WalletLedgerPageProjection {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { entries?: unknown }).entries));
}

export function useWildsWalletController(identityKey: string) {
  const [state, dispatch] = useReducer(reduceWildsWalletController, identityKey, initialState);
  const stateRef = useRef(state);
  const requestSequence = useRef(0);
  const refreshAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    if (stateRef.current.identityKey === identityKey) return;
    refreshAbortRef.current?.abort();
    dispatch({ type: "identity-invalidated", identityKey });
  }, [identityKey]);
  useEffect(() => () => refreshAbortRef.current?.abort(), []);

  const refresh = useCallback(async () => {
    if (stateRef.current.status === "loading") return;
    const requestId = ++requestSequence.current;
    const identityAtStart = stateRef.current.identityKey;
    const controller = new AbortController();
    refreshAbortRef.current?.abort();
    refreshAbortRef.current = controller;
    dispatch({ type: "refresh-start", requestId });
    try {
      const [summaryValue, capabilitiesValue, ledgerValue] = await Promise.all([
        fetch("/api/wilds/wallet/summary", { cache: "no-store", credentials: "same-origin", signal: controller.signal }).then(readJson),
        fetch("/api/wilds/wallet/capabilities", { cache: "no-store", credentials: "same-origin", signal: controller.signal }).then(readJson),
        fetch("/api/wilds/wallet/ledger", { cache: "no-store", credentials: "same-origin", signal: controller.signal }).then(readJson)
      ]);
      if (!isSummary(summaryValue) || !isCapabilities(capabilitiesValue) || !isLedger(ledgerValue)) throw new Error("wilds_wallet_projection_invalid");
      const response = { summary: summaryValue, capabilities: capabilitiesValue, ledger: ledgerValue };
      verifiedWalletCache.set(identityAtStart, response);
      dispatch({ type: "refresh-resolved", requestId, identityKey: identityAtStart, ...response });
    } catch (cause) {
      if (controller.signal.aborted) return;
      const status = typeof cause === "object" && cause !== null && "status" in cause && typeof cause.status === "number"
        ? cause.status : null;
      dispatch({ type: "refresh-failed", requestId, reason: classifyWildsWalletRefreshFailure(status) });
    } finally {
      if (refreshAbortRef.current === controller) refreshAbortRef.current = null;
    }
  }, []);

  const open = useCallback(() => {
    dispatch({ type: "open" });
    void refresh();
  }, [refresh]);
  const close = useCallback(() => {
    refreshAbortRef.current?.abort();
    dispatch({ type: "close" });
  }, []);
  const navigate = useCallback((page: WildsWalletPage) => dispatch({ type: "navigate", page }), []);
  const lookupRecipient = useCallback((username: string) => {
    // The public route intentionally refuses production lookup until an injected durable limiter exists.
    dispatch({ type: "recipient-lookup-unavailable", username });
  }, []);
  const requestReceive = useCallback(async (amountPhiMicro?: string) => {
    try {
      const value = await fetch("/api/wilds/wallet/request", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(amountPhiMicro ? { amountPhiMicro } : {})
      }).then(readJson);
      if (!value || typeof value !== "object" || typeof (value as { locator?: unknown }).locator !== "string") throw new Error("wilds_wallet_request_invalid");
      dispatch({ type: "receive-request-resolved", locator: (value as { locator: string }).locator });
    } catch {
      dispatch({ type: "receive-request-cleared" });
    }
  }, []);

  return { ...state, openTerminal: open, closeTerminal: close, navigate, refresh, lookupRecipient, requestReceive };
}
