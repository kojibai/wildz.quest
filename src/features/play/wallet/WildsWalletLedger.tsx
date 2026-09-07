"use client";

import React, { useMemo, useState } from "react";
import type { PortableCardAsset } from "../portable-card";
import type { WildsResourceLotV1 } from "../wilds-resource-lot";
import type { WildsMaterialLotV1, WildsStewardPhiAwardV1 } from "../wilds-steward-construction";
import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact } from "./wilds-wallet-format";
import type { WildsLivingOperationPlanV1 } from "../wilds-living-operation";
import { ledgerKaiTime, type WildsActivityEntry } from "./wilds-activity-history";
import { PhiNetworkAmount } from "./PhiNetworkMark";

type LedgerFilter = "all" | "value" | "creatures" | "materials" | "resources" | "activity";
type LocalEntry = Readonly<{ id: string; kind: Exclude<LedgerFilter, "all">; title: string; detail: string; value: string; timing: string; uPulse: number | null; status?: string; constitution?: WildsActivityEntry["constitution"] }>;

export function WildsWalletLedger({ actionHistory = [], livingOperations = {}, cards = [], materialLots = [], resourceLots = [], state, stewardPhiAwards = [] }: {
  actionHistory?: readonly WildsActivityEntry[];
  livingOperations?: Readonly<Record<string, WildsLivingOperationPlanV1>>;
  cards?: readonly PortableCardAsset[];
  materialLots?: readonly WildsMaterialLotV1[];
  resourceLots?: readonly WildsResourceLotV1[];
  state: WildsWalletControllerState;
  stewardPhiAwards?: readonly WildsStewardPhiAwardV1[];
}) {
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const localEntries = useMemo<readonly LocalEntry[]>(() => [
    ...stewardPhiAwards.map((award): LocalEntry => ({ id: award.awardId, kind: "value", title: "Stewardship award", detail: `Source proof · ${award.operationId}`, value: formatWildsPhiExact(award.amountPhiMicro), ...ledgerKaiTime({ uPulse: livingOperations[award.operationId]?.kaiUPulse }) })),
    ...cards.map((card): LocalEntry => ({ id: card.id, kind: "creatures", title: "Creature admitted", detail: `${card.manifest.name} · ${card.manifest.rarity}`, value: `Stage ${card.manifest.stage}`, ...ledgerKaiTime({ occurredAt: card.manifest.capturedAt }) })),
    ...materialLots.map((lot): LocalEntry => ({ id: lot.lotId, kind: "materials", title: lot.kind === "timber" ? "Timber gathered" : lot.kind === "hay" ? "Hay gathered" : "Stone gathered", detail: `Source proof · ${lot.source.sourceId}`, value: "1 exact unit", ...ledgerKaiTime({ uPulse: lot.source.kaiUPulse }) })),
    ...resourceLots.map((lot): LocalEntry => ({ id: lot.lotId, kind: "resources", title: "Living Honey gathered", detail: `Grove · ${lot.source.groveId}`, value: `${lot.quantity} exact unit${lot.quantity === 1 ? "" : "s"}`, ...ledgerKaiTime({ uPulse: lot.source.kaiUPulse }) }))
    ,...actionHistory.map((entry): LocalEntry => ({ ...entry, value: entry.authority === "local" ? "Local activity" : "World activity", ...ledgerKaiTime({ uPulse: entry.uPulse }), status: "local" }))
  ], [actionHistory, cards, livingOperations, materialLots, resourceLots, stewardPhiAwards]);
  const remoteEntries: LocalEntry[] = (state.ledger?.entries ?? []).map((entry, index) => ({
    id: `transfer:${entry.createdAt}:${index}`, kind: "value",
    title: entry.direction === "sent" ? "Sent" : entry.direction === "received" ? "Received" : "Transfer",
    detail: `${entry.state} · ${entry.counterpartyUsername ? `@${entry.counterpartyUsername}` : "Privacy-safe counterparty"}`,
    value: entry.amountPhiMicro ? formatWildsPhiExact(entry.amountPhiMicro) : "—",
    ...ledgerKaiTime({ occurredAt: entry.createdAt }), status: entry.state
  }));
  const entries = [...localEntries, ...remoteEntries].reverse().sort((a, b) => (b.uPulse ?? -Infinity) - (a.uPulse ?? -Infinity));
  const shownLocal = filter === "all" ? entries : entries.filter((entry) => entry.kind === filter);
  const counts = { all: entries.length, value: entries.filter((entry) => entry.kind === "value").length, creatures: cards.length, materials: materialLots.length, resources: resourceLots.length, activity: actionHistory.length };
  return <section aria-labelledby="wilds-wallet-ledger-title" className="wilds-wallet-surface">
    <header><small>ACTIVITY & RECEIPTS</small><h2 id="wilds-wallet-ledger-title">Ledger</h2><a href="/laws" target="_blank" rel="noreferrer">World law ↗</a></header>
    <div aria-label="Ledger activity filters" className="wilds-wallet-ledger-filters" role="group">{([[
      "all", "All activity"], ["value", "Value"], ["creatures", "Creatures"], ["materials", "Materials"], ["resources", "Resources"], ["activity", "Gameplay"]
    ] as const).map(([value, label]) => <button aria-pressed={filter === value} key={value} onClick={() => setFilter(value)} type="button"><span>{label}</span><b>{counts[value]}</b></button>)}</div>
    <div className="wilds-wallet-ledger" role="list">{shownLocal.map((entry) => <article key={entry.id} role="listitem">
      <span className={`is-${entry.status ?? "committed"}`} aria-hidden="true" />
      <div><p><b>{entry.title}</b><small>{entry.detail}</small></p>{entry.constitution && <details><summary>Source &amp; world law</summary><p>{entry.constitution.result} · {entry.constitution.rulesApplied.join(" · ")}</p><small>Actor: {entry.constitution.actor}</small><small>Source: {entry.constitution.sourceState}</small><small>Successor: {entry.constitution.successor ?? "Unresolved"}</small><small>Challenge this claim by identifying its source or a failed predicate.</small></details>}</div>
      <p><strong>{entry.kind === "value" ? <PhiNetworkAmount value={entry.value} /> : entry.value}</strong><small>{entry.timing}</small></p>
    </article>)}
    {!shownLocal.length ? <p className="wilds-wallet-empty-ledger">No {filter === "all" ? "ledger" : filter} entries yet.</p> : null}</div>
  </section>;
}
