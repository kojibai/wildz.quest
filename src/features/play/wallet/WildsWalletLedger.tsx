"use client";

import React, { useMemo, useState } from "react";
import type { PortableCardAsset } from "../portable-card";
import type { WildsResourceLotV1 } from "../wilds-resource-lot";
import type { WildsMaterialLotV1, WildsStewardPhiAwardV1 } from "../wilds-steward-construction";
import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact } from "./wilds-wallet-format";
import { PhiNetworkAmount } from "./PhiNetworkMark";

type LedgerFilter = "all" | "value" | "creatures" | "materials" | "resources";
type LocalEntry = Readonly<{ id: string; kind: Exclude<LedgerFilter, "all">; title: string; detail: string; value: string; timing: string }>;

export function WildsWalletLedger({ cards = [], materialLots = [], resourceLots = [], state, stewardPhiAwards = [] }: {
  cards?: readonly PortableCardAsset[];
  materialLots?: readonly WildsMaterialLotV1[];
  resourceLots?: readonly WildsResourceLotV1[];
  state: WildsWalletControllerState;
  stewardPhiAwards?: readonly WildsStewardPhiAwardV1[];
}) {
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const localEntries = useMemo<readonly LocalEntry[]>(() => [
    ...stewardPhiAwards.map((award): LocalEntry => ({ id: award.awardId, kind: "value", title: "Stewardship award", detail: `Source proof · ${award.operationId}`, value: formatWildsPhiExact(award.amountPhiMicro), timing: `settled at edge · ${award.head.slice(0, 14)}…` })),
    ...cards.map((card): LocalEntry => ({ id: card.id, kind: "creatures", title: "Creature admitted", detail: `${card.manifest.name} · ${card.manifest.rarity}`, value: `Stage ${card.manifest.stage}`, timing: new Date(card.manifest.capturedAt).toLocaleDateString() })),
    ...materialLots.map((lot): LocalEntry => ({ id: lot.lotId, kind: "materials", title: lot.kind === "timber" ? "Timber gathered" : "Stone gathered", detail: `Source proof · ${lot.source.sourceId}`, value: "1 exact unit", timing: `Kai ${lot.source.kaiUPulse} · Q${lot.quality}` })),
    ...resourceLots.map((lot): LocalEntry => ({ id: lot.lotId, kind: "resources", title: "Living Honey gathered", detail: `Grove · ${lot.source.groveId}`, value: `${lot.quantity} exact unit${lot.quantity === 1 ? "" : "s"}`, timing: `Kai ${lot.source.kaiUPulse} · Q${lot.quality}` }))
  ], [cards, materialLots, resourceLots, stewardPhiAwards]);
  const shownLocal = filter === "all" ? localEntries : localEntries.filter((entry) => entry.kind === filter);
  const remoteEntries = filter === "all" || filter === "value" ? state.ledger?.entries ?? [] : [];
  const counts = { all: localEntries.length + (state.ledger?.entries.length ?? 0), value: stewardPhiAwards.length + (state.ledger?.entries.length ?? 0), creatures: cards.length, materials: materialLots.length, resources: resourceLots.length };
  return <section aria-labelledby="wilds-wallet-ledger-title" className="wilds-wallet-surface">
    <header><small>IMMUTABLE RECEIPT REGISTER</small><h2 id="wilds-wallet-ledger-title">Ledger</h2></header>
    <div aria-label="Ledger activity filters" className="wilds-wallet-ledger-filters" role="group">{([[
      "all", "All activity"], ["value", "Value"], ["creatures", "Creatures"], ["materials", "Materials"], ["resources", "Resources"]
    ] as const).map(([value, label]) => <button aria-pressed={filter === value} key={value} onClick={() => setFilter(value)} type="button"><span>{label}</span><b>{counts[value]}</b></button>)}</div>
    <div className="wilds-wallet-ledger" role="list">{shownLocal.map((entry) => <article key={entry.id} role="listitem">
      <span className="is-committed" aria-hidden="true" />
      <p><b>{entry.title}</b><small>{entry.detail}</small></p>
      <p><strong>{entry.kind === "value" ? <PhiNetworkAmount value={entry.value} /> : entry.value}</strong><small>{entry.timing}</small></p>
    </article>)}
    {remoteEntries.map((entry, index) => <article key={`${entry.createdAt}-${index}`} role="listitem">
      <span className={`is-${entry.state}`} aria-hidden="true" />
      <p><b>{entry.direction === "sent" ? "Sent" : entry.direction === "received" ? "Received" : "Transfer"}</b><small>{entry.counterpartyUsername ? `@${entry.counterpartyUsername}` : "Privacy-safe counterparty"}</small></p>
      <p><strong>{entry.amountPhiMicro ? <PhiNetworkAmount value={formatWildsPhiExact(entry.amountPhiMicro)} /> : "—"}</strong><small>{entry.state} · {new Date(entry.createdAt).toLocaleDateString()}</small></p>
    </article>)}
    {!shownLocal.length && !remoteEntries.length ? <p className="wilds-wallet-empty-ledger">No exact {filter === "all" ? "ledger" : filter} entries yet.</p> : null}</div>
  </section>;
}
