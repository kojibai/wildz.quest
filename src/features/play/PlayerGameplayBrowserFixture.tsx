"use client";

import { useEffect, useMemo, useState } from "react";
import { createPlacementFixture } from "./creation/CreationPlacementBrowserFixture";
import { applyWildsInput, createOwnerBoundInitialPlayState, type PlayState } from "./game-state";
import { observeWildsKaiUPulse } from "./wilds-kai-runtime";
import { PlayCampaign } from "./PlayCampaign";
import { generateWildzCharacter } from "../identity/wildz-genesis";
import { admitWildsDiscoveryPhysicalNeighborhood } from "./wilds-discovery-sites";
import { prepareWildsSiteRuntime, wildsSiteRuntimeGroundY } from "./wilds-site-runtime";
import { createWildsPlayerVault } from "./wilds-player-vault";

/** Exercises the production canvas, input, rest and overlay path without a live identity. */
export default function PlayerGameplayBrowserFixture() {
  const [fixture, setFixture] = useState<ReturnType<typeof createPlacementFixture> | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [movementMode, setMovementMode] = useState<"walk" | "run">("walk");
  const [observed, setObserved] = useState<PlayState | null>(null);
  useEffect(() => {
    const current = createPlacementFixture({ownerId: "player_gameplay_fixture", storageKey: "wildz:test-fixture:player-gameplay:v1"});
    setFixture(current);
    return () => {current.controller.close(); current.worker.close();};
  }, []);
  const initial = useMemo(() => {
    if (!fixture) return null;
    const base = createOwnerBoundInitialPlayState(fixture.owner), player = {x: 5000, z: 5000};
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(Math.floor(player.x / 128), Math.floor(player.z / 128)));
    const y = wildsSiteRuntimeGroundY(runtime, base.siteSpace.spaceId, player.x, player.z, Number.NaN);
    const state = {...base, inventory: [fixture.card], discoveredCardIds: [fixture.card.manifest.familyId], selectedAssetId: fixture.card.id, selectedCardId: fixture.card.manifest.familyId,
      adventureConditions: fixture.conditions, player, siteSpace: {...base.siteSpace, position: {...player, y}}};
    return sleeping ? applyWildsInput(state, {type: "sleep", kaiUPulse: observeWildsKaiUPulse()}) : state;
  }, [fixture, sleeping]);
  const continuity = useMemo(() => fixture && initial ? createWildsPlayerVault({ playerId: fixture.owner, exportedAt: "2026-10-09T00:00:00.000Z", playState: initial,
    settings: { avatarStyle: null, movementMode, audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] }) : null, [fixture, initial, movementMode]);
  if (!fixture || !initial) return <p>Loading gameplay fixture…</p>;
  return <main className="wildz-app-shell">
    <nav aria-label="Gameplay fixture modes" style={{position: "fixed", top: 3, left: 3, zIndex: 2000, display: "flex", alignItems: "flex-start", gap: 5}}>
      <button type="button" onClick={() => setSleeping(false)}>Awake fixture</button>
      <button type="button" onClick={() => setSleeping(true)}>Sleeping fixture</button>
      <button type="button" onClick={() => setMovementMode(mode => mode === "walk" ? "run" : "walk")}>{movementMode === "walk" ? "Running fixture" : "Walking fixture"}</button>
      <output data-testid="gameplay-state" style={{fontSize: 7, maxWidth: 140, maxHeight: 24, overflow: "hidden", pointerEvents: "none"}}>{JSON.stringify({player: observed?.player ?? initial.player, mode: observed?.playerBreaths?.mode ?? initial.playerBreaths?.mode,
        event: observed?.lastEvent, cardXp: observed?.cardXp, progress: observed?.companionProgress[fixture.card.manifest.familyId], beans: observed?.beans})}</output>
    </nav>
    <div className="wildz-app"><PlayCampaign key={`${sleeping}:${movementMode}`} enabled networkEnabled={false} creationController={fixture.controller}
      ownerReceizId={fixture.owner} initialState={initial} initialWorld={{projection: fixture.queue.current(), mode: "kai_live"}}
      initialPlayerContinuity={continuity}
      character={generateWildzCharacter({identityRef: fixture.owner, kaiPulse: "1", gender: "female", version: 1})}
      playerDisplayName="Gameplay fixture" walletAuthorityGeneration="fixture" walletIdentityKey={fixture.owner} walletPublicUsername={null}
      onPlayStateChange={state => setObserved(state)} onPrepareCard={async () => {throw Error("fixture_export_disabled");}}
      onExportCard={async () => {}} onExportVault={async () => {}} vaultAdmission={null}
      onRestoreArtifact={async () => {throw Error("fixture_import_disabled");}} onRestoreRoamingCapture={async () => {throw Error("fixture_import_disabled");}} />
    </div>
  </main>;
}
