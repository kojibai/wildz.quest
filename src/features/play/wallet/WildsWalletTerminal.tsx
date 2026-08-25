"use client";

import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { WildsWalletControllerState, WildsWalletPage, WildsWalletPresentationState } from "./wilds-wallet-controller";
import { PhiNetworkMark } from "./PhiNetworkMark";
import { WildsWalletAssets } from "./WildsWalletAssets";
import { WildsWalletLedger } from "./WildsWalletLedger";
import { WildsWalletOverview } from "./WildsWalletOverview";
import { WildsWalletReceive } from "./WildsWalletReceive";
import { WildsWalletSend, type WildsWalletSendActions } from "./WildsWalletSend";
import type { PortableCardAsset } from "@/features/play/portable-card";
import type { AdventureCardCondition } from "@/features/play/adventure/card-condition";
import type { WildzPreparedIdentityOwnedCard } from "@/lib/receiz/wildz-identity-adapter";
import type { WildsResourceLotV1 } from "@/features/play/wilds-resource-lot";
import type { WildsMaterialLotV1 } from "@/features/play/wilds-steward-construction";

const pages: readonly Readonly<{ page: WildsWalletPage; label: string; mark: string }>[] = [
  { page: "overview", label: "Overview", mark: "◫" }, { page: "send", label: "Send", mark: "↗" },
  { page: "receive", label: "Receive", mark: "↙" }, { page: "assets", label: "Assets", mark: "◇" },
  { page: "ledger", label: "Ledger", mark: "≡" }
];

export function nextWildsWalletPageForKey(page: WildsWalletPage, key: string): WildsWalletPage | null {
  const index = pages.findIndex((item) => item.page === page);
  if (key === "Home") return pages[0]!.page;
  if (key === "End") return pages[pages.length - 1]!.page;
  if (key === "ArrowRight" || key === "ArrowDown") return pages[(index + 1) % pages.length]!.page;
  if (key === "ArrowLeft" || key === "ArrowUp") return pages[(index - 1 + pages.length) % pages.length]!.page;
  return null;
}

export function canCloseWildsWalletTerminal(state: WildsWalletControllerState) {
  return !["stage", "authorize-pending"].includes(state.transfer.phase) && state.transfer.authorizationPointerId === null;
}

export type WildsWalletTerminalActions = WildsWalletSendActions & Readonly<{
  onClose(): void;
  onNavigate(page: WildsWalletPage): void;
  onOpenVaultCard?(assetId: string): void;
  onRefresh(): void;
  onRequestReceive(amountPhiMicro?: string): void;
  onReturnToMessages?(): void;
}>;

export function WildsWalletTerminal({ cards = [], cardConditions = {}, materialLots = [], resourceLots = [], onPrepareCard, onSendCard, onSendResource, publicUsername, state, ...actions }: {
  cards?: readonly PortableCardAsset[];
  cardConditions?: Readonly<Record<string, AdventureCardCondition>>;
  resourceLots?: readonly WildsResourceLotV1[];
  materialLots?: readonly WildsMaterialLotV1[];
  onPrepareCard?: (asset: PortableCardAsset) => Promise<WildzPreparedIdentityOwnedCard>;
  onSendCard?: (asset: PortableCardAsset, targetHandle: string) => Promise<unknown>;
  onSendResource?: (resourceLot: WildsResourceLotV1, targetHandle: string) => Promise<Readonly<{ claimUrl: string }>>;
  publicUsername: string | null;
  state: WildsWalletPresentationState;
} & WildsWalletTerminalActions) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  if (!state.open) return null;
  const moveTab = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const next = nextWildsWalletPageForKey(state.page, event.key);
    if (!next) return;
    event.preventDefault();
    actions.onNavigate(next);
    const index = pages.findIndex((item) => item.page === next);
    window.requestAnimationFrame(() => tabRefs.current[index]?.focus());
  };
  const closeAllowed = canCloseWildsWalletTerminal(state);
  const authority = state.status === "verified" || state.status === "source-verified" || (state.status === "authority-required" && state.edgeAuthorityVerified) ? "VERIFIED" : state.status === "offline-verified" ? "OFFLINE VERIFIED" : state.status === "authority-required" ? "AUTHORIZATION REQUIRED" : state.transfer.phase === "unknown" ? "RECOVERY PENDING" : "UNAVAILABLE";
  return <div className="wilds-wallet-layer" data-wallet-page={state.page}>
    <button aria-label="Close sovereign wallet" className="wilds-wallet-scrim" disabled={!closeAllowed} onClick={actions.onClose} tabIndex={-1} type="button" />
    <section aria-labelledby="wilds-wallet-terminal-title" aria-modal="true" className="wilds-wallet-terminal" role="dialog" tabIndex={-1}>
      <header className="wilds-wallet-terminal-header">
        <PhiNetworkMark className="wilds-wallet-phi-seal" />
        <span><small>PRIVATE VALUE AUTHORITY</small><h1 id="wilds-wallet-terminal-title">WILDZ SOVEREIGN TERMINAL</h1></span>
        <span className="wilds-wallet-identity"><b title={publicUsername ? `@${publicUsername}` : undefined}>{publicUsername ? `@${publicUsername}` : "PUBLIC HANDLE NOT AVAILABLE"}</b><small data-wallet-authority={authority.toLowerCase().replaceAll(" ", "-")}>{authority}</small></span>
        <button aria-label="Close sovereign wallet" disabled={!closeAllowed} onClick={actions.onClose} type="button">×</button>
      </header>
      <nav aria-label="Wallet terminal" className="wilds-wallet-navigation" role="tablist">{pages.map((item, index) => <button aria-controls={`wilds-wallet-panel-${item.page}`} aria-selected={state.page === item.page} key={item.page} onClick={() => actions.onNavigate(item.page)} onKeyDown={moveTab} ref={(node) => { tabRefs.current[index] = node; }} role="tab" tabIndex={state.page === item.page ? 0 : -1} type="button"><i aria-hidden="true">{item.mark}</i><span>{item.label}</span></button>)}</nav>
      <main className="wilds-wallet-terminal-content" id={`wilds-wallet-panel-${state.page}`} role="tabpanel">
        {state.page === "overview" ? <WildsWalletOverview state={state} onNavigate={actions.onNavigate} /> : null}
        {state.page === "send" ? <WildsWalletSend state={state} {...actions} /> : null}
        {state.page === "receive" ? <WildsWalletReceive publicUsername={publicUsername} state={state} onRequestReceive={actions.onRequestReceive} /> : null}
        {state.page === "assets" ? <WildsWalletAssets cards={cards} cardConditions={cardConditions} materialLots={materialLots} resourceLots={resourceLots} onOpenVaultCard={closeAllowed ? actions.onOpenVaultCard : undefined} onPrepareCard={onPrepareCard} onSendCard={onSendCard} onSendResource={onSendResource} state={state} /> : null}
        {state.page === "ledger" ? <WildsWalletLedger state={state} /> : null}
      </main>
      <footer><span>RECEIZ V124 · PROOF-NATIVE CUSTODY</span><span>PRIVATE · NO-STORE</span></footer>
    </section>
  </div>;
}
