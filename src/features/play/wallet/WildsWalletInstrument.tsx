"use client";

import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiCompact, formatWildsPhiExact } from "./wilds-wallet-format";
import { Icons } from "@/components/icons";

function instrumentState(state: WildsWalletControllerState) {
  if (state.status === "verified") return { tone: "verified", spoken: "verified" };
  if (state.status === "loading") return { tone: "pending", spoken: "verifying" };
  if (state.status === "authority-required") return { tone: "secure", spoken: "authorization required" };
  if (state.status === "offline-verified") return { tone: "offline", spoken: "offline verified" };
  if (state.status === "failed" || state.status === "revoked") return { tone: "failed", spoken: "unavailable" };
  return { tone: "secure", spoken: "not yet verified" };
}

export function WildsWalletInstrument({
  disabled,
  onOpen,
  state
}: {
  disabled: boolean;
  onOpen: (origin: HTMLButtonElement) => void;
  state: WildsWalletControllerState;
}) {
  const status = instrumentState(state);
  const exact = state.summary ? formatWildsPhiExact(state.summary.admittedPhiMicro) : null;
  return <button
    aria-label={exact
      ? `Open sovereign wallet. Exact admitted Phi reserve: ${exact} Phi. Status: ${status.spoken}.`
      : `Open sovereign wallet. Phi reserve ${status.spoken}.`}
    className="wilds-wallet-instrument"
    data-wallet-status={status.tone}
    disabled={disabled}
    onClick={(event) => onOpen(event.currentTarget)}
    type="button"
  >
    <span aria-hidden="true" className="wilds-wallet-glyph"><Icons.wallet strokeWidth={1.8} /></span>
    <strong aria-hidden="true">{state.summary ? `Φ ${formatWildsPhiCompact(state.summary.admittedPhiMicro)}` : state.status === "loading" ? "Φ …" : "Φ —"}</strong>
  </button>;
}
