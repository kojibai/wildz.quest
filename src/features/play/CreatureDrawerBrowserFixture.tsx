"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WildzCreatureDrawer } from "./WildzCreatureDrawer";
import type { CreatureDrawerSnap } from "./creature-drawer";
import { sealCollectedCard } from "./portable-card";
import type { VaultCompanionRosterEntry } from "./vault-companion-roster";

const fixtureAssets = Array.from({ length: 17 }, (_, index) => sealCollectedCard({
  formId: "mintcub-1",
  ownerReceizId: "browser.fixture",
  encounterId: `drawer-fixture-${index}`,
  capturedAt: `2026-08-11T14:30:${String(index).padStart(2, "0")}.000Z`
}));
const initialFixtureAssetId = fixtureAssets[2]!.id;

export function CreatureDrawerBrowserFixture() {
  const [snap, setSnap] = useState<CreatureDrawerSnap>("closed");
  const [selectedAssetId, setSelectedAssetId] = useState(initialFixtureAssetId);
  const [selectionCount, setSelectionCount] = useState(0);
  const originRef = useRef<HTMLButtonElement | null>(null);
  const previousSnapRef = useRef<CreatureDrawerSnap>("closed");
  const entries = useMemo<readonly VaultCompanionRosterEntry[]>(() => fixtureAssets.map((asset, index) => ({
    asset,
    name: asset.manifest.name,
    level: index + 1,
    xp: index * 10,
    bond: index,
    fatigue: 0,
    injuryCount: 0,
    conditionLabel: "Ready",
    element: "Leaf",
    species: asset.manifest.species,
    active: asset.id === selectedAssetId,
    newlyCaptured: false
  })), [selectedAssetId]);

  useEffect(() => {
    if (previousSnapRef.current !== "closed" && snap === "closed") {
      window.requestAnimationFrame(() => originRef.current?.focus());
    }
    previousSnapRef.current = snap;
  }, [snap]);

  return <main className="wildz-companion-home" data-testid="creature-drawer-browser-fixture">
    <h1>Creature Drawer browser fixture</h1>
    <button
      onClick={() => setSnap("preview")}
      ref={originRef}
      type="button"
    >Open fixture Slate</button>
    <button onClick={() => setSnap("closed")} type="button">Controlled close fixture Slate</button>
    <output data-active-id={selectedAssetId} data-expected-active-index="14" data-selection-count={selectionCount} id="selection-count">
      {selectionCount}:{selectedAssetId}
    </output>
    <WildzCreatureDrawer
      cardOrder="newest"
      entries={entries}
      onCardOrderChange={() => {}}
      onSelectCard={(assetId) => {
        setSelectionCount((count) => count + 1);
        setSelectedAssetId(assetId);
      }}
      onSnapChange={setSnap}
      snap={snap}
    />
  </main>;
}
