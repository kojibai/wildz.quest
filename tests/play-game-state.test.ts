import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyWildsInput,
  canDiscover,
  createOwnerBoundInitialPlayState,
  initialPlayState,
  restorePlayState,
  serializePlayState,
  type PlayState
} from "../src/features/play/game-state";
import { admitLegacyCard, currentLivingGenome, currentRevision, emptyLivingGrowth } from "../src/features/play/living-card-proof.js";
import { nextGrowthRequirements } from "../src/features/play/growth-engine.js";
import { canonicalPortableCardJson, evolvePortableCard, sealCollectedCard, verifyAnyWildsCard, verifyPortableCard } from "../src/features/play/portable-card.js";
import { nearbyHiddenHotspots, wildsHotspotProjectionDiagnostics } from "../src/features/play/hidden-hotspots.js";
import { isLivingCardAsset } from "../src/features/play/living-card-types.js";
import { livingCreatureIdentityDigest } from "../src/features/play/living-taxonomy.js";
import {
  projectCardCreatureVisualIdentity,
  projectEncounterCreatureVisualIdentity,
  projectLivingGenomeCreatureVisualIdentity
} from "../src/features/play/creature-visual-identity.js";
import { createWildsCivicEvent } from "../src/features/play/wilds-civic-history.js";
import { sealRetirement } from "../src/features/games/lifecycle/creature-retirement.js";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { wildsTerrainObstaclesForTile } from "../src/features/play/wilds-terrain-obstacles.js";
import { wildsTraversalProjectionDiagnostics } from "../src/features/play/wilds-traversal-capabilities.js";
import { authorizeRiftTravel } from "../src/features/play/wilds-rift-travel.js";
import {
  revealWildsExplorationAt,
  wildsExplorationContainsWorld
} from "../src/features/play/wilds-exploration-atlas.js";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority.js";
import { admitWildsDiscoveryPhysicalNeighborhood, normalizeWildsSiteSpaceState } from "../src/features/play/wilds-discovery-sites.js";
import { prepareWildsSiteRuntime } from "../src/features/play/wilds-site-runtime.js";

function activeTravelState(): PlayState {
  const capturedAt = "2026-07-13T11:00:00.000Z";
  const asset = admitLegacyCard(sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "travel.player",
    encounterId: "travel-player-card",
    capturedAt
  }), capturedAt);
  return {
    ...structuredClone(initialPlayState),
    inventory: [asset],
    selectedAssetId: asset.id,
    selectedCardId: asset.manifest.familyId,
    livingProgress: { [asset.id]: currentRevision(asset).growth },
    player: { x: 7.9, z: 0 }
  };
}

describe("persistent discovery-site play continuity", () => {
  it("moves inside the canonical dry cave even where the hidden outer terrain is deep water", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(-49, -51));
    const siteKey = "wildz.site.v1:-49:-51:2:e06d3f20d8147d7d";
    const portal = runtime.physical.portals.find((candidate) => candidate.siteKey === siteKey)!;
    assert.ok(portal);
    let state: PlayState = {
      ...structuredClone(initialPlayState),
      player: { x: portal.position.x, z: portal.position.z },
      siteSpace: normalizeWildsSiteSpaceState(undefined, portal.position)
    };
    state = applyWildsInput(state, { type: "site-portal", direction: "enter", siteKey, siteRuntime: runtime });
    const moved = applyWildsInput(state, { type: "move-vector", x: 1, z: 0, mode: "walk", siteRuntime: runtime });
    assert.ok(moved.player.x > state.player.x);
    assert.doesNotMatch(moved.lastEvent, /Deep water/);
  });

  it("enters, moves, serializes, restores, and exits the exact admitted interior space", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(3, 2));
    const portal = runtime.physical.portals[0]!;
    let state: PlayState = {
      ...structuredClone(initialPlayState),
      player: { x: portal.position.x, z: portal.position.z },
      siteSpace: normalizeWildsSiteSpaceState(undefined, portal.position)
    };
    state = applyWildsInput(state, { type: "site-portal", direction: "enter", siteKey: portal.siteKey, siteRuntime: runtime });
    assert.equal(state.siteSpace.spaceId, portal.toSpaceId);
    assert.equal(state.siteSpace.siteKey, portal.siteKey);
    assert.equal(state.explorationAtlas.siteKeys.includes(portal.siteKey), true);

    const moved = applyWildsInput(state, { type: "move-vector", x: .25, z: .1, mode: "walk", siteRuntime: runtime });
    assert.equal(moved.siteSpace.spaceId, portal.toSpaceId);
    assert.ok(moved.siteSpace.surfaceId);
    const restored = restorePlayState(serializePlayState(moved));
    assert.deepEqual(restored.siteSpace, moved.siteSpace);
    assert.deepEqual(restored.player, moved.player);

    const exited = applyWildsInput(restored, { type: "site-portal", direction: "exit", siteKey: portal.siteKey, siteRuntime: runtime });
    assert.equal(exited.siteSpace.spaceId, "wildz.space.outer.v1");
    assert.deepEqual(exited.player, { x: portal.position.x, z: portal.position.z });
  });

  it("rejects forged interior continuity during restore", () => {
    const forged = structuredClone(initialPlayState);
    forged.siteSpace = {
      version: "wildz.site-space-state.v1",
      spaceId: "wildz.space.v1:wildz.site.v1:3:2:1:0000000000000000:interior",
      siteKey: "wildz.site.v1:3:2:1:0000000000000000",
      surfaceId: "surface:forged",
      position: { x: 999_999, y: 999_999, z: 999_999 },
      flooded: false
    };
    const restored = restorePlayState(serializePlayState(forged));
    assert.equal(restored.siteSpace.spaceId, "wildz.space.outer.v1");
    assert.deepEqual({ x: restored.siteSpace.position.x, z: restored.siteSpace.position.z }, restored.player);
  });
});

describe("site-qualified encounter continuity", () => {
  it("persists only the canonical site and space through restore", () => {
    const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(0, 0));
    const found = runtime.physical.encounterVolumes.flatMap((volume) => nearbyHiddenHotspots(volume.center).map((hotspot) => ({ hotspot, volume }))).find(({ hotspot, volume }) =>
      hotspot.requiredCapability === null
      && Math.abs(hotspot.placement.x - volume.center.x) <= volume.halfExtents.x
      && Math.abs(hotspot.placement.z - volume.center.z) <= volume.halfExtents.z
      && hotspot.placement.worldY >= volume.center.y - volume.halfExtents.y
      && hotspot.placement.worldY <= volume.center.y + volume.halfExtents.y);
    assert.ok(found);
    const base = activeTravelState();
    const state = { ...base, player: { x: found.hotspot.placement.x, z: found.hotspot.placement.z } };
    const searched = applyWildsInput(state, {
      type: "search-point",
      x: found.hotspot.placement.x,
      z: found.hotspot.placement.z,
      searchedAt: "2026-08-21T12:00:00.000Z",
      ownerReceizId: "@site-explorer",
      verticalLayer: found.hotspot.placement.layer === "air" ? "air" : found.hotspot.placement.layer === "water-column" || found.hotspot.placement.layer === "seabed" ? "water" : "ground",
      verticalWorldY: found.hotspot.placement.worldY,
      verticalMinWorldY: found.hotspot.placement.interactionBand.minY,
      verticalMaxWorldY: found.hotspot.placement.interactionBand.maxY,
      siteKey: found.volume.siteKey,
      siteSpaceId: found.volume.spaceId
    });
    assert.notEqual(searched.encounter.phase, "idle");
    if (searched.encounter.phase === "idle") return;
    assert.deepEqual(searched.encounter.siteContext, { siteKey: found.volume.siteKey, spaceId: found.volume.spaceId });
    const restored = restorePlayState(serializePlayState(searched));
    assert.notEqual(restored.encounter.phase, "idle");
    if (restored.encounter.phase === "idle") return;
    assert.deepEqual(restored.encounter.siteContext, searched.encounter.siteContext);
    const tampered = structuredClone(searched);
    if (tampered.encounter.phase !== "idle") tampered.encounter.siteContext = { siteKey: found.volume.siteKey, spaceId: "wildz.space.outer.v1:forged" };
    const rejected = restorePlayState(serializePlayState(tampered));
    assert.equal(rejected.encounter.phase, "idle");

    const capturable = { ...searched, encounter: { ...searched.encounter, phase: "capsule" as const } } as PlayState;
    const sealed = applyWildsInput(capturable, { type: "advance-encounter", at: "2026-08-21T12:00:01.000Z" });
    assert.notEqual(sealed.encounter.phase, "idle");
    if (sealed.encounter.phase !== "idle") assert.deepEqual(sealed.encounter.siteContext, searched.encounter.siteContext);
  });
});

describe("layered encounter continuity", () => {
  it("rejects a remote camera scan before generating a distant encounter", () => {
    const far = { x: 240, z: -240 };
    const before = structuredClone(initialPlayState);
    const projectionsBefore = wildsHotspotProjectionDiagnostics();
    const after = applyWildsInput(before, {
      type: "search-point",
      x: far.x,
      z: far.z,
      searchedAt: "2026-08-21T15:00:00.000Z",
      ownerReceizId: "layered.remote.guard",
      verticalLayer: "ground",
      verticalWorldY: sampleWildsTerrain(before.player.x, before.player.z).elevation,
      traversalCapabilities: []
    });
    assert.equal(after.encounter.phase, "idle");
    assert.match(after.lastEvent, /move closer/i);
    assert.deepEqual(wildsHotspotProjectionDiagnostics(), projectionsBefore);
  });

  it("preserves the canonical hotspot layer position and visual identity through battle capture and restore", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player).find((candidate) => candidate.requiredCapability === null)!;
    const player = { x: hotspot.position.x, z: hotspot.position.z };
    let state = applyWildsInput({ ...structuredClone(initialPlayState), player }, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-08-21T15:10:00.000Z",
      ownerReceizId: "layered.capture.player",
      verticalLayer: hotspot.layer === "air" || hotspot.layer === "surface" ? "ground" : hotspot.layer === "water-column" || hotspot.layer === "seabed" ? "water" : "ground",
      verticalWorldY: hotspot.layer === "air"
        ? sampleWildsTerrain(player.x, player.z).elevation
        : hotspot.worldY,
      traversalCapabilities: []
    });
    assert.equal(state.encounter.phase, "battle_intro");
    const placement = {
      position: state.encounter.placement ? { x: state.encounter.placement.x, z: state.encounter.placement.z } : undefined,
      layer: state.encounter.placement?.layer,
      worldY: state.encounter.placement?.worldY
    };
    const identity = state.encounter.discoveryIdentity;
    assert.deepEqual(placement.position, hotspot.position);
    assert.equal(placement.layer, hotspot.layer);
    assert.equal(placement.worldY, hotspot.worldY);
    assert.ok(identity);

    state = applyWildsInput(state, { type: "start-battle", at: "2026-08-21T15:10:01.000Z" });
    assert.equal(state.encounter.phase, "player_turn");
    assert.deepEqual({
      position: state.encounter.placement ? { x: state.encounter.placement.x, z: state.encounter.placement.z } : undefined,
      layer: state.encounter.placement?.layer,
      worldY: state.encounter.placement?.worldY
    }, placement);
    for (let turn = 0; turn < 20 && state.encounter.phase === "player_turn"; turn += 1) state = applyWildsInput(state, {
      type: "battle-action",
      action: state.battle!.player.energy >= 12 ? { type: "ability", slot: 0 } : { type: "guard" }
    });
    for (let attempt = 0; attempt < 5 && state.encounter.phase === "capture_ready"; attempt += 1) state = applyWildsInput(state, {
      type: "battle-action",
      action: { type: "capture" }
    });
    assert.equal(state.encounter.phase, "capsule");
    state = applyWildsInput(state, { type: "advance-encounter", at: "2026-08-21T15:10:02.000Z" });
    assert.equal(state.encounter.phase, "sealed");
    const restored = restorePlayState(serializePlayState(state));
    assert.equal(restored.encounter.phase, "revealed");
    assert.deepEqual({
      position: restored.encounter.placement ? { x: restored.encounter.placement.x, z: restored.encounter.placement.z } : undefined,
      layer: restored.encounter.placement?.layer,
      worldY: restored.encounter.placement?.worldY
    }, placement);
    assert.equal(canonicalPortableCardJson(restored.encounter.discoveryIdentity), canonicalPortableCardJson(identity));
    const captured = restored.inventory.find((asset) => asset.manifest.encounterId === hotspot.id)!;
    assert.ok(captured);
    assert.equal(canonicalPortableCardJson(projectCardCreatureVisualIdentity(captured)), canonicalPortableCardJson(projectEncounterCreatureVisualIdentity({
      identity: restored.encounter.discoveryIdentity!,
      formId: restored.encounter.formId!
    })));
  });

  it("rederives a legacy missing placement from its stable region slot", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player).find((candidate) => candidate.requiredCapability === null)!;
    const player = { x: hotspot.position.x, z: hotspot.position.z };
    const state = applyWildsInput({ ...structuredClone(initialPlayState), player }, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-08-21T15:20:00.000Z",
      ownerReceizId: "layered.legacy.player",
      verticalLayer: "ground",
      verticalWorldY: sampleWildsTerrain(player.x, player.z).elevation,
      traversalCapabilities: []
    });
    assert.equal(state.encounter.phase, "battle_intro");
    const envelope = JSON.parse(serializePlayState(state));
    delete envelope.state.encounter.placement;

    const restored = restorePlayState(JSON.stringify(envelope));
    if (restored.encounter.phase === "idle") throw new Error("expected active layered encounter");
    assert.deepEqual(restored.encounter.placement, hotspot.placement);
    assert.deepEqual(restored.encounter.searchPoint, state.encounter.searchPoint);
  });

  it("replaces every shape-valid placement splice with the canonical region-slot placement", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player).find((candidate) => candidate.requiredCapability === null)!;
    const player = { x: hotspot.position.x, z: hotspot.position.z };
    const state = applyWildsInput({ ...structuredClone(initialPlayState), player }, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-08-21T15:30:00.000Z",
      ownerReceizId: "layered.tamper.player",
      verticalLayer: "ground",
      verticalWorldY: sampleWildsTerrain(player.x, player.z).elevation,
      traversalCapabilities: []
    });
    assert.equal(state.encounter.phase, "battle_intro");
    const preservedIdentity = canonicalPortableCardJson(state.encounter.discoveryIdentity);
    const splices = [
      { x: hotspot.x + .5 },
      { z: hotspot.z - .5 },
      { worldY: hotspot.worldY + 1 },
      { layer: hotspot.layer === "ground" ? "air" : "ground" },
      { requiredCapability: hotspot.requiredCapability === "flight" ? "swim" : "flight" },
      { identity: "wildz.layer.v1:9:9:9:0000000000000009" }
    ];

    for (const splice of splices) {
      const envelope = JSON.parse(serializePlayState(state));
      Object.assign(envelope.state.encounter.placement, splice);
      const restored = restorePlayState(JSON.stringify(envelope));
      if (restored.encounter.phase === "idle") throw new Error("expected restored encounter");
      assert.deepEqual(restored.encounter.placement, hotspot.placement, JSON.stringify(splice));
      assert.equal(canonicalPortableCardJson(restored.encounter.discoveryIdentity), preservedIdentity, JSON.stringify(splice));
    }
  });

  it("reconstructs a missing identity from canonical placement and seals the same creature after a displaced click", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player).find((candidate) => candidate.requiredCapability === null)!;
    const player = { x: hotspot.position.x, z: hotspot.position.z };
    const discovered = applyWildsInput({ ...structuredClone(initialPlayState), player }, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-08-21T15:40:00.000Z",
      ownerReceizId: "layered.identity.player",
      verticalLayer: "ground",
      verticalWorldY: sampleWildsTerrain(player.x, player.z).elevation,
      traversalCapabilities: []
    });
    assert.equal(discovered.encounter.phase, "battle_intro");
    if (!discovered.encounter.discoveryIdentity || !discovered.encounter.formId) throw new Error("expected discovered identity");
    const expectedIdentity = discovered.encounter.discoveryIdentity;
    const expectedVisual = projectEncounterCreatureVisualIdentity({ identity: expectedIdentity, formId: discovered.encounter.formId });
    const envelope = JSON.parse(serializePlayState({
      ...discovered,
      encounter: {
        ...discovered.encounter,
        phase: "capsule",
        searchPoint: { x: hotspot.position.x + .75, z: hotspot.position.z - .5 }
      }
    }));
    delete envelope.state.encounter.discoveryIdentity;

    const restored = restorePlayState(JSON.stringify(envelope));
    assert.equal(restored.encounter.phase, "capsule");
    if (!restored.encounter.discoveryIdentity || !restored.encounter.formId) throw new Error("expected reconstructed identity");
    assert.equal(restored.encounter.discoveryIdentity.name.display, expectedIdentity.name.display);
    assert.deepEqual(projectEncounterCreatureVisualIdentity({
      identity: restored.encounter.discoveryIdentity,
      formId: restored.encounter.formId
    }), expectedVisual);

    const sealed = applyWildsInput(restored, { type: "advance-encounter", at: "2026-08-21T15:40:08.000Z" });
    const captured = sealed.inventory.find((asset) => asset.manifest.encounterId === hotspot.id)!;
    assert.ok(captured);
    assert.equal(captured.manifest.name, expectedIdentity.name.display);
    assert.deepEqual(projectCardCreatureVisualIdentity(captured), expectedVisual);
  });
});

describe("Receiz Wilds game state", () => {
  it("reveals exploration only when admitted movement enters a new sight area", () => {
    const player = { x: 245, z: -1433 };
    const migrated = {
      ...initialPlayState,
      player,
      explorationAtlas: revealWildsExplorationAt(initialPlayState.explorationAtlas, player)
    };
    const inside = applyWildsInput(migrated, { type: "move-vector", x: 0.1, z: 0 });
    assert.equal(inside.explorationAtlas, migrated.explorationAtlas);

    const edge = { ...migrated, player: { x: 287.9, z: -1433 } };
    const crossed = applyWildsInput(edge, { type: "move-vector", x: 1, z: 0 });
    assert.notEqual(crossed.explorationAtlas, edge.explorationAtlas);
    assert.equal(wildsExplorationContainsWorld(crossed.explorationAtlas, crossed.player), true);
  });

  it("an admitted Rift reveals destination sight without painting its corridor", () => {
    const destination = { x: 4_800, z: -9_600 };
    const result = authorizeRiftTravel({
      idempotencyKey: "rift-exploration-test",
      source: initialPlayState.player,
      destination
    }, { playerId: "player-1", coordinationPulse: "42", locked: false });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const next = applyWildsInput(initialPlayState, {
      type: "apply-rift-grant",
      grant: result.grant,
      playerId: "player-1"
    });
    assert.equal(wildsExplorationContainsWorld(next.explorationAtlas, destination), true);
    assert.equal(wildsExplorationContainsWorld(next.explorationAtlas, { x: 2_400, z: -4_800 }), false);
  });

  it("normalizes restored exploration against the same clamped player position", () => {
    const saved = {
      ...structuredClone(initialPlayState),
      player: { x: 500_000_048, z: 0 }
    };
    const restored = restorePlayState(serializePlayState(saved));
    assert.deepEqual(restored.player, { x: 500_000_000, z: 0 });
    assert.equal(wildsExplorationContainsWorld(restored.explorationAtlas, restored.player), true);
  });

  it("keeps traversal projection allocation-free after selecting an uploaded card", () => {
    const uploaded = sealCollectedCard({
      formId: "ledgerfox-1",
      ownerReceizId: "upload-traversal-player",
      encounterId: "upload-traversal-fast-path",
      capturedAt: "2026-08-21T13:00:00.000Z"
    });
    let state = applyWildsInput(initialPlayState, { type: "import-card", asset: uploaded });
    assert.ok(state.adventureConditions[uploaded.id]);
    assert.ok(state.hearttreeConditions[uploaded.id]);
    state = applyWildsInput(state, { type: "move-vector", x: 1, z: 0 });
    const warm = wildsTraversalProjectionDiagnostics();
    for (let index = 0; index < 300; index += 1) {
      state = applyWildsInput(state, { type: "move-vector", x: index % 2 === 0 ? -1 : 1, z: 0 });
    }
    assert.deepEqual(wildsTraversalProjectionDiagnostics(), warm);
  });

  it("promotes a living Vault card when the selected Mortal Arena card is retired", () => {
    const retiredBase = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "wilds.player.receiz.id", encounterId: "retired-only", capturedAt: "2026-07-18T10:00:00.000Z" });
    const admitted = admitLegacyCard(retiredBase, "2026-07-18T10:00:00.000Z");
    const retired = sealRetirement(admitted, {
      creatureId: admitted.id,
      previousRevisionDigest: currentRevision(admitted).digest,
      matchReceiptDigest: `sha256:${"a".repeat(64)}`,
      finalVitality: 0,
      teamOutcome: "defeat",
      retiredAt: "2026-07-18T10:05:00.000Z",
      kaiUPulse: admitted.manifest.history!.events.at(-1)!.kai.uPulse + 1
    }, { verified: true, mortalOptIn: true }).card;
    const restoredCard = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "wilds.player.receiz.id", encounterId: "vault-rescue", capturedAt: "2026-07-18T10:10:00.000Z" });
    const saved = {
      ...structuredClone(initialPlayState),
      inventory: [retired, restoredCard],
      selectedAssetId: retired.id,
      selectedCardId: retired.manifest.familyId
    };

    const restored = restorePlayState(serializePlayState(saved));
    assert.equal(restored.selectedAssetId, restoredCard.id);
    assert.equal(restored.selectedCardId, restoredCard.manifest.familyId);
  });

  it("records each gameplay growth event once and awards earned catalysts", () => {
    const assetId = initialPlayState.inventory[0]!.id;
    const event = {
      eventId: "battle:boss:first",
      path: "battle" as const,
      amount: 20,
      occurredAt: "2026-07-13T17:00:00.000Z",
      achievementId: "boss_victory_first"
    };
    const once = applyWildsInput(initialPlayState, { type: "record-growth", assetId, event });
    const replay = applyWildsInput(once, { type: "record-growth", assetId, event });

    assert.equal(once.livingProgress[assetId]!.paths.battle, 20);
    assert.equal(once.ascensionCatalysts.length, initialPlayState.ascensionCatalysts.length + 1);
    assert.deepEqual(replay.livingProgress[assetId], once.livingProgress[assetId]);
    assert.deepEqual(replay.ascensionCatalysts, once.ascensionCatalysts);
  });

  it("appends an earned Ascension under the stable card id and consumes its catalyst once", () => {
    const legacy = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "wilds.player.receiz.id", encounterId: "ascension-game", capturedAt: "2026-07-10T15:00:00.000Z" });
    const birth = admitLegacyCard(legacy, "2026-07-10T15:00:00.000Z");
    const stageTwo = evolvePortableCard({ previous: birth, nextFormId: "mintcub-2", evolvedAt: "2026-07-11T15:00:00.000Z" });
    const stageThree = evolvePortableCard({ previous: stageTwo, nextFormId: "mintcub-3", evolvedAt: "2026-07-12T15:00:00.000Z" });
    const at = "2026-07-13T17:00:00.000Z";
    const requirements = nextGrowthRequirements(stageThree, at);
    const progress = {
      ...emptyLivingGrowth(requirements.bond),
      achievementIds: ["boss_victory_ascension"],
      completedQuestIds: [requirements.quest.id]
    };
    const catalyst = `ascension:tier:${requirements.catalystTier}:boss-reward`;
    const ready: PlayState = {
      ...initialPlayState,
      inventory: [stageThree],
      selectedAssetId: stageThree.id,
      selectedCardId: stageThree.manifest.familyId,
      livingProgress: { [stageThree.id]: progress },
      ascensionCatalysts: [catalyst]
    };

    const ascended = applyWildsInput(ready, { type: "ascend-card", assetId: stageThree.id, at });
    const replay = applyWildsInput(ascended, { type: "ascend-card", assetId: stageThree.id, at });

    assert.equal(ascended.inventory.length, 1);
    assert.equal(ascended.inventory[0]!.id, stageThree.id);
    assert.equal(currentRevision(ascended.inventory[0] as typeof stageThree).ascensionRank, 1);
    assert.equal(currentRevision(ascended.inventory[0] as typeof stageThree).kaiPulse, String(deriveKaiKlokMoment({ occurredAt: at, authority: "local" }).uPulse));
    assert.equal((ascended.inventory[0] as typeof stageThree).manifest.revisions.length, stageThree.manifest.revisions.length + 1);
    assert.equal(ascended.ascensionCatalysts.includes(catalyst), false);
    assert.equal(ascended.transformation?.assetId, stageThree.id);
    assert.equal((replay.inventory[0] as typeof stageThree).manifest.revisions.length, (ascended.inventory[0] as typeof stageThree).manifest.revisions.length);
  });
  it("imports an offline-verified portable card once and makes its family playable", () => {
    const uploaded = sealCollectedCard({
      formId: "voltray-1",
      ownerReceizId: "returning.player.receiz.id",
      encounterId: "uploaded-card-1",
      capturedAt: "2026-07-13T16:00:00.000Z"
    });
    const imported = applyWildsInput(initialPlayState, { type: "import-card", asset: uploaded });
    const duplicate = applyWildsInput(imported, { type: "import-card", asset: uploaded });

    assert.equal(imported.inventory.some((asset) => asset.id === uploaded.id), true);
    assert.equal(imported.discoveredCardIds.includes("voltray"), true);
    assert.equal(imported.selectedCardId, "voltray");
    assert.equal(duplicate.inventory.length, imported.inventory.length);
  });

  it("merges a newer valid living revision for the same portable asset id", () => {
    const legacy = sealCollectedCard({
      formId: "voltray-1",
      ownerReceizId: "returning.player.receiz.id",
      encounterId: "uploaded-living-card",
      capturedAt: "2026-07-13T16:00:00.000Z"
    });
    const living = admitLegacyCard(legacy, "2026-07-13T16:01:00.000Z");
    const evolved = evolvePortableCard({ previous: living, nextFormId: "voltray-2", evolvedAt: "2026-07-13T17:00:00.000Z" });
    const imported = applyWildsInput(initialPlayState, { type: "import-card", asset: living });
    const merged = applyWildsInput(imported, { type: "import-card", asset: evolved });
    const restored = merged.inventory.find((asset) => asset.id === evolved.id);

    assert.equal(merged.inventory.filter((asset) => asset.id === evolved.id).length, 1);
    assert.equal(restored?.manifest.formId, "voltray-2");
    assert.equal(isLivingCardAsset(restored) ? restored.manifest.revisions.length : 0, evolved.manifest.revisions.length);
    assert.equal(currentRevision(evolved).kaiPulse, String(deriveKaiKlokMoment({ occurredAt: "2026-07-13T17:00:00.000Z", authority: "local" }).uPulse));
    assert.equal(merged.livingProgress[evolved.id]?.eventIds.length, currentRevision(evolved).growth.eventIds.length);
  });

  it("spends one earned Spark to add a child while preserving reusable parents", () => {
    const second = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "wilds.player.receiz.id", encounterId: "fusion-test-b", capturedAt: "2026-07-13T15:00:00.000Z" });
    const ready = applyWildsInput(initialPlayState, { type: "import-card", asset: second });
    const input = { type: "fuse-cards" as const, parentAId: ready.inventory[0]!.id, parentBId: second.id, inheritance: "balanced" as const, fusedAt: "2026-07-13T17:00:00.000Z" };
    const fused = applyWildsInput(ready, input);
    const replay = applyWildsInput(fused, input);
    assert.equal(fused.inventory.length, ready.inventory.length + 1);
    assert.equal(fused.inventory.some((asset) => asset.id === ready.inventory[0]!.id), true);
    assert.equal(fused.inventory.some((asset) => asset.id === second.id), true);
    assert.equal(fused.fusionSparks, ready.fusionSparks - 1);
    assert.equal(fused.selectedAssetId, fused.inventory.at(-1)?.id);
    assert.equal(replay.inventory.length, fused.inventory.length);
    assert.equal(fused.inventory.every((asset) => isLivingCardAsset(asset)), true);
    assert.equal(fused.inventory.at(-1)?.manifest.variant.generatorVersion, 3);
    assert.equal(fused.inventory.at(-1)?.manifest.variant.kaiPulse, String(deriveKaiKlokMoment({ occurredAt: input.fusedAt, authority: "local" }).uPulse));
    assert.match(fused.inventory.at(-1)?.manifest.name ?? "", /^[A-Z][a-z]{1,6}$/);
    assert.doesNotMatch(fused.inventory.at(-1)?.manifest.name ?? "", /flowkin/i);
    assert.equal(currentRevision(fused.inventory[0] as ReturnType<typeof admitLegacyCard>).childEventIds.length, 1);
    assert.equal(currentRevision(fused.inventory[1] as ReturnType<typeof admitLegacyCard>).childEventIds.length, 1);
    const child = fused.inventory.at(-1)!;
    assert.equal(isLivingCardAsset(child), true);
    if (!isLivingCardAsset(child)) return;
    assert.equal(child.manifest.birth.kind, "fusion");
    assert.deepEqual(
      projectCardCreatureVisualIdentity(child),
      projectLivingGenomeCreatureVisualIdentity(currentLivingGenome(child), child.manifest.formId)
    );
  });

  it("selects any exact inventory asset as the active battle card", () => {
    const uploaded = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "wilds.player.receiz.id", encounterId: "active-upload", capturedAt: "2026-07-13T16:00:00.000Z" });
    const inventory = applyWildsInput(initialPlayState, { type: "import-card", asset: uploaded });
    const selected = applyWildsInput(inventory, { type: "select-asset", assetId: uploaded.id });
    assert.equal(selected.selectedAssetId, uploaded.id);
    assert.equal(selected.selectedCardId, uploaded.manifest.familyId);
    assert.match(selected.lastEvent, /leading your active deck/i);
  });

  it("moves the player into range and collects a new companion card", () => {
    let state = initialPlayState;

    state = applyWildsInput(state, { type: "move", direction: "east" });
    state = applyWildsInput(state, { type: "move", direction: "east" });
    state = applyWildsInput(state, { type: "move", direction: "east" });
    state = applyWildsInput(state, { type: "move", direction: "north" });

    assert.equal(canDiscover(state), true);

    const next = applyWildsInput(state, { type: "discover" });

    assert.equal(next.discoveredCardIds.includes("voltray"), true);
    assert.equal(next.selectedCardId, "voltray");
    assert.equal(next.beans > state.beans, true);
    assert.match(next.lastEvent, /Voltray card collected/);
    assert.equal(next.inventory.length, state.inventory.length + 1);
    assert.equal(next.inventory.at(-1)?.manifest.formId, "voltray-1");
    assert.equal(verifyPortableCard(next.inventory.at(-1)!).ok, true);
    assert.equal(next.pendingSyncAssetIds.includes(next.inventory.at(-1)!.id), true);
  });

  it("captures and seals one portable card atomically for an encounter", () => {
    const nearby: PlayState = { ...initialPlayState, player: { x: 1.6, z: -2.1 } };
    const input = {
      type: "capture" as const,
      encounterId: "encounter-voltray-test",
      capturedAt: "2026-07-13T15:00:00.000Z",
      ownerReceizId: "player.receiz.id"
    };
    const once = applyWildsInput(nearby, input);
    const twice = applyWildsInput(once, input);

    assert.equal(once.inventory.length, initialPlayState.inventory.length + 1);
    assert.equal(twice.inventory.length, once.inventory.length);
    assert.equal(twice.inventory.at(-1)?.id, once.inventory.at(-1)?.id);
    assert.equal(once.inventory.at(-1)?.manifest.variant.generatorVersion, 3);
    assert.match(once.inventory.at(-1)?.manifest.name ?? "", /^[A-Z][a-z]{1,6}$/);
    assert.doesNotMatch(once.inventory.at(-1)?.manifest.name ?? "", /flowkin/i);
    assert.match(once.lastEvent, /sealed for offline use/i);
  });

  it("searches, battles, seals, and reveals a hidden hotspot atomically", () => {
    const leaderId = initialPlayState.selectedAssetId;
    const hotspot = nearbyHiddenHotspots(initialPlayState.player)[0]!;
    const searched = applyWildsInput(initialPlayState, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-07-13T15:00:00.000Z",
      ownerReceizId: "player.receiz.id"
    });

    assert.equal(searched.encounter.phase, "battle_intro");
    const discoveryIdentity = searched.encounter.discoveryIdentity;
    assert.ok(discoveryIdentity);
    assert.equal(searched.inventory.length, initialPlayState.inventory.length);
    assert.equal(searched.livingProgress[leaderId]!.paths.exploration > initialPlayState.livingProgress[leaderId]!.paths.exploration, true);

    let battling = applyWildsInput(searched, { type: "start-battle", at: "2026-07-13T15:00:01.000Z" });
    assert.equal(battling.encounter.phase, "player_turn");
    for (let turn = 0; turn < 20 && battling.encounter.phase === "player_turn"; turn += 1) {
      battling = applyWildsInput(battling, { type: "battle-action", action: battling.battle!.player.energy >= 12 ? { type: "ability", slot: 0 } : { type: "guard" } });
    }
    assert.equal(battling.encounter.phase, "capture_ready");
    assert.equal(battling.livingProgress[leaderId]!.paths.battle > searched.livingProgress[leaderId]!.paths.battle, true);
    for (let attempt = 0; attempt < 5 && battling.encounter.phase === "capture_ready"; attempt += 1) {
      battling = applyWildsInput(battling, { type: "battle-action", action: { type: "capture" } });
    }
    const capsule = battling;
    assert.equal(capsule.encounter.phase, "capsule");
    assert.equal(capsule.inventory.length, initialPlayState.inventory.length);
    const settledLeader = capsule.inventory.find((asset) => asset.id === leaderId);
    assert.ok(settledLeader && isLivingCardAsset(settledLeader));
    assert.equal(capsule.pendingSyncAssetIds.includes(leaderId), true);
    assert.deepEqual(capsule.livingProgress[leaderId], currentRevision(settledLeader).growth);

    const sealed = applyWildsInput(capsule, { type: "advance-encounter", at: "2026-07-13T15:00:02.000Z" });
    assert.equal(sealed.encounter.phase, "sealed");
    assert.equal(sealed.inventory.length, initialPlayState.inventory.length + 1);
    assert.equal(sealed.capturedHotspotIds.includes(hotspot.id), true);
    assert.equal(verifyPortableCard(sealed.inventory.at(-1)!).ok, true);
    const captured = sealed.inventory.at(-1)!;
    assert.equal(captured.manifest.variant.generatorVersion, 3);
    if (captured.manifest.variant.generatorVersion === 3) {
      assert.equal(
        canonicalPortableCardJson(captured.manifest.variant.traits.identity),
        canonicalPortableCardJson(discoveryIdentity)
      );
    }

    const revealed = applyWildsInput(sealed, { type: "advance-encounter", at: "2026-07-13T15:00:03.000Z" });
    assert.equal(revealed.encounter.phase, "revealed");
    assert.equal(revealed.encounter.assetId, sealed.inventory.at(-1)!.id);

    const dismissed = applyWildsInput(revealed, { type: "dismiss-reveal" });
    const searchedAgain = applyWildsInput(dismissed, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-07-13T15:01:00.000Z",
      ownerReceizId: "player.receiz.id"
    });
    assert.equal(searchedAgain.encounter.phase, "hint");
    assert.equal(searchedAgain.inventory.length, sealed.inventory.length);
  });

  it("synchronizes a local card without minting another asset", () => {
    const nearby: PlayState = { ...initialPlayState, player: { x: 1.6, z: -2.1 } };
    const captured = applyWildsInput(nearby, {
      type: "capture",
      encounterId: "encounter-sync-test",
      capturedAt: "2026-07-13T15:00:00.000Z",
      ownerReceizId: "player.receiz.id"
    });
    const asset = captured.inventory.at(-1)!;
    const synced = applyWildsInput(captured, {
      type: "mark-synced",
      assetId: asset.id,
      synchronizedAt: "2026-07-13T15:01:00.000Z"
    });

    assert.equal(synced.inventory.length, captured.inventory.length);
    assert.equal(synced.inventory.at(-1)?.status, "verified");
    assert.equal(synced.pendingSyncAssetIds.includes(asset.id), false);

    const listed = applyWildsInput(synced, {
      type: "mark-listed",
      assetId: asset.id,
      synchronizedAt: "2026-07-13T15:02:00.000Z"
    });
    assert.equal(listed.inventory.at(-1)?.status, "listed");
  });

  it("evolves an eligible living card in place while retaining append-only history", () => {
    const base = initialPlayState.inventory[0]!;
    const earned = applyWildsInput(initialPlayState, {
      type: "record-growth",
      assetId: base.id,
      event: { eventId: "battle_win:evolution-proof", kind: "battle_win", path: "battle", amount: 9, occurredAt: "2026-07-14T14:00:00.000Z" }
    });
    const ready: PlayState = {
      ...earned,
      companionProgress: {
        ...earned.companionProgress,
        mintcub: { level: 10, xp: 0, bond: 100 }
      }
    };
    const evolved = applyWildsInput(ready, {
      type: "evolve",
      assetId: base.id,
      evolvedAt: "2026-07-14T15:00:00.000Z"
    });

    assert.equal(evolved.inventory.length, ready.inventory.length);
    assert.equal(evolved.inventory[0]?.id, base.id);
    assert.equal(evolved.inventory[0]?.manifest.formId, "mintcub-2");
    assert.equal(evolved.inventory[0]?.manifest.schema, "receiz.wilds_living_card_manifest.v2");
    if (evolved.inventory[0] && isLivingCardAsset(evolved.inventory[0])) {
      assert.equal(evolved.inventory[0].manifest.currentRevision, 1);
      assert.equal(evolved.inventory[0].manifest.revisions.length, 2);
      assert.equal(currentRevision(evolved.inventory[0]).growth.paths.battle, 9);
    }
  });

  it("does not select cards the player has not collected", () => {
    const next = applyWildsInput(initialPlayState, { type: "select-card", cardId: "voltray" });

    assert.equal(next, initialPlayState);
  });

  it("turns legacy mission completion into a permanent story achievement", () => {
    const readyState: PlayState = {
      ...initialPlayState,
      completed: false,
      discoveredCardIds: ["mintcub", "voltray", "ledgerfox"],
      missionProgress: 91,
      rewardCards: [],
      selectedCardId: "voltray"
    };

    const next = applyWildsInput(readyState, { type: "mission" });

    assert.equal(next.completed, true);
    assert.equal(next.missionProgress, 100);
    assert.equal(next.rewardCards.length, 0);
    assert.ok(next.achievements.includes("first-light"));
    assert.match(next.lastEvent, /First Light is now part of your story/);
    assert.equal(next.worldMastery, readyState.worldMastery + 25);
  });

  it("levels and bonds the selected companion through deterministic training", () => {
    let state = initialPlayState;
    state = applyWildsInput(state, { type: "train", at: "2026-07-13T12:00:00.000Z" });
    const blocked = applyWildsInput(state, { type: "train", at: "2026-07-13T12:01:00.000Z" });
    state = applyWildsInput(blocked, { type: "train", at: "2026-07-13T12:15:00.000Z" });
    state = applyWildsInput(state, { type: "train", at: "2026-07-13T12:30:00.000Z" });

    assert.equal(blocked.companionProgress.mintcub.bond, 1);
    assert.equal(state.companionProgress.mintcub.level, 2);
    assert.equal(state.companionProgress.mintcub.bond, 3);
    assert.equal(state.livingProgress[state.selectedAssetId]!.paths.bond, 3);
    assert.match(blocked.lastEvent, /^SealCub is resting/);
    assert.match(state.lastEvent, /^SealCub reached Level 2/);
  });

  it("uses the individual creature name when XP raises its level", () => {
    const creature = sealCollectedCard({
      formId: "voltray-1",
      ownerReceizId: "receiz:named-trainer",
      encounterId: "encounter:named-trainer",
      capturedAt: "2026-07-17T12:00:00.000Z",
      generatorVersion: 2
    });
    const imported = applyWildsInput(initialPlayState, { type: "import-card", asset: creature });
    const ready = {
      ...imported,
      companionProgress: { ...imported.companionProgress, [creature.manifest.familyId]: { level: 1, xp: 80, bond: 0 } }
    };
    const leveled = applyWildsInput(ready, { type: "train", at: "2026-07-17T12:15:00.000Z" });

    assert.match(leveled.lastEvent, new RegExp(`^${creature.manifest.name} reached Level 2`));
  });

  it("queues active travel without changing card truth on the movement frame", () => {
    const ready = activeTravelState();
    const crossed = applyWildsInput(ready, { type: "move", direction: "east" });
    const within = applyWildsInput(crossed, { type: "move-vector", x: 0.2, z: 0 });
    const pending = (crossed as PlayState & { pendingTravelGrowthEvents?: unknown[] }).pendingTravelGrowthEvents;

    assert.equal(crossed.inventory, ready.inventory);
    assert.equal(crossed.livingProgress[ready.selectedAssetId]!.paths.bond, ready.livingProgress[ready.selectedAssetId]!.paths.bond);
    assert.equal(pending?.length, 1);
    assert.equal((within as PlayState & { pendingTravelGrowthEvents?: unknown[] }).pendingTravelGrowthEvents?.length, 1);
  });

  it("settles queued travel into the exact card only outside the walking path", () => {
    const ready = activeTravelState();
    const crossed = applyWildsInput(ready, { type: "move", direction: "east" });
    const restored = restorePlayState(serializePlayState(crossed), "travel.player");
    const settleInput = { type: "settle-pending-travel-growth" } as unknown as Parameters<typeof applyWildsInput>[1];
    const settled = applyWildsInput(restored, settleInput);
    const replay = applyWildsInput(settled, settleInput);

    assert.equal(restored.pendingTravelGrowthEvents.length, 1);
    assert.notEqual(settled.inventory, restored.inventory);
    assert.equal(settled.livingProgress[ready.selectedAssetId]!.paths.bond, ready.livingProgress[ready.selectedAssetId]!.paths.bond + 1);
    assert.deepEqual((settled as PlayState & { pendingTravelGrowthEvents?: unknown[] }).pendingTravelGrowthEvents, []);
    assert.equal(replay, settled);
  });

  it("restored pending travel cannot smuggle growth authority", () => {
    const crossed = applyWildsInput(activeTravelState(), { type: "move", direction: "east" });
    const altered = structuredClone(crossed);
    altered.pendingTravelGrowthEvents[0]!.event.achievementId = "forged_travel_achievement";
    altered.pendingTravelGrowthEvents[0]!.event.questId = "forged_travel_quest";

    const restored = restorePlayState(serializePlayState(altered), "travel.player");
    const settled = applyWildsInput(restored, { type: "settle-pending-travel-growth" });
    const progress = settled.livingProgress[settled.selectedAssetId]!;

    assert.equal(progress.achievementIds.includes("forged_travel_achievement"), false);
    assert.equal(progress.completedQuestIds.includes("forged_travel_quest"), false);
  });

  it("blocks exhausted actions and lets the scout make camp to recover", () => {
    const exhausted = { ...initialPlayState, energy: 0 };
    const blocked = applyWildsInput(exhausted, { type: "mission" });
    const rested = applyWildsInput(blocked, { type: "rest" });

    assert.equal(blocked.missionProgress, exhausted.missionProgress);
    assert.match(blocked.lastEvent, /energy/i);
    assert.equal(rested.energy, 35);
    assert.equal(rested.combo, 0);
  });

  it("unlocks the Titan expedition from deck breadth and companion mastery", () => {
    const readyState: PlayState = {
      ...initialPlayState,
      discoveredCardIds: ["mintcub", "voltray", "ledgerfox"],
      companionProgress: {
        ...initialPlayState.companionProgress,
        mintcub: { level: 3, xp: 0, bond: 6 },
        voltray: { level: 1, xp: 0, bond: 0 },
        ledgerfox: { level: 1, xp: 0, bond: 0 }
      }
    };

    const next = applyWildsInput(readyState, { type: "mission" });
    assert.equal(next.bossUnlocked, true);
    assert.equal(next.worldRank, "Titan challenger");
  });

  it("round-trips versioned progression and rejects corrupted saves", () => {
    const trained = applyWildsInput(initialPlayState, { type: "train" });
    const migrated = restorePlayState(serializePlayState(trained));
    assert.equal(migrated.inventory.every((asset) => isLivingCardAsset(asset)), true);
    assert.deepEqual(restorePlayState(serializePlayState(migrated)), migrated);
    assert.deepEqual(restorePlayState("not-json"), initialPlayState);
  });

  it("records verified civic history once and derives regional reputation", () => {
    const event = createWildsCivicEvent({
      settlementId: "wayfinder-hollow",
      actorId: "wilds.player.receiz.id",
      kind: "service.completed",
      sourceId: "orientation",
      occurredAt: "2026-07-15T18:00:00.000Z",
      cardProofDigest: null,
      reputation: 5
    });
    const once = applyWildsInput(initialPlayState, { type: "record-civic-event", event });
    const replay = applyWildsInput(once, { type: "record-civic-event", event });
    const tampered = applyWildsInput(once, { type: "record-civic-event", event: { ...event, reputation: 99 } });

    assert.deepEqual(once.civicEvents, [event]);
    assert.equal(once.regionalReputation["wayfinder-hollow"], 5);
    assert.deepEqual(replay, once);
    assert.deepEqual(tampered, once);
  });

  it("persists personal history in v9 and safely migrates v2 through v8 saves", () => {
    const event = createWildsCivicEvent({
      settlementId: "wayfinder-hollow",
      actorId: "wilds.player.receiz.id",
      kind: "puzzle.completed",
      sourceId: "route-memory:2026-07-15",
      occurredAt: "2026-07-15T18:05:00.000Z",
      cardProofDigest: null,
      reputation: 5
    });
    const progressed = applyWildsInput(initialPlayState, { type: "record-civic-event", event });
    const serialized = serializePlayState(progressed);
    const envelope = JSON.parse(serialized);
    const legacyState = { ...initialPlayState } as Partial<PlayState> & Record<string, unknown>;
    delete legacyState.civicEvents;
    delete legacyState.regionalReputation;
    delete legacyState.supportAssetIds;

    assert.equal(envelope.schema, "receiz.wilds.save.v9");
    assert.deepEqual(restorePlayState(serialized).civicEvents, [event]);
    assert.equal(restorePlayState(serialized).regionalReputation["wayfinder-hollow"], 5);
    for (let version = 2; version <= 8; version += 1) {
      assert.deepEqual(
        restorePlayState(JSON.stringify({ schema: `receiz.wilds.save.v${version}`, state: legacyState })).civicEvents,
        []
      );
      assert.deepEqual(
        restorePlayState(JSON.stringify({ schema: `receiz.wilds.save.v${version}`, state: legacyState })).supportAssetIds,
        [null, null]
      );
    }
  });

  it("normalizes support slots and removes a selected leader from support", () => {
    const owner = "support_keeper";
    const leader = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: owner, encounterId: "support-leader", capturedAt: "2026-07-15T10:00:00.000Z" });
    const support = sealCollectedCard({ formId: "voltray-1", ownerReceizId: owner, encounterId: "support-one", capturedAt: "2026-07-15T11:00:00.000Z" });
    const state: PlayState = {
      ...createOwnerBoundInitialPlayState(owner),
      inventory: [leader, support],
      discoveredCardIds: ["mintcub", "voltray"],
      selectedAssetId: leader.id,
      selectedCardId: "mintcub",
      supportAssetIds: [null, null]
    };
    const assigned = applyWildsInput(state, { type: "assign-support", slot: 0, assetId: support.id });
    assert.deepEqual(assigned.supportAssetIds, [support.id, null]);
    assert.deepEqual(applyWildsInput(assigned, { type: "select-asset", assetId: support.id }).supportAssetIds, [null, null]);

    const duplicateEnvelope = JSON.parse(serializePlayState(state));
    duplicateEnvelope.state.supportAssetIds = [support.id, support.id];
    assert.deepEqual(restorePlayState(JSON.stringify(duplicateEnvelope), owner).supportAssetIds, [support.id, null]);
    duplicateEnvelope.state.supportAssetIds = [leader.id, "missing"];
    assert.deepEqual(restorePlayState(JSON.stringify(duplicateEnvelope), owner).supportAssetIds, [null, null]);
  });

  it("issues starter and legacy-discovery cards to the exact active owner", () => {
    const owner = "new_explorer";
    const bornAt = "2026-07-17T18:42:11.000Z";
    const starter = createOwnerBoundInitialPlayState(owner, bornAt);
    const repeated = createOwnerBoundInitialPlayState(owner, bornAt);
    const other = createOwnerBoundInitialPlayState("another_explorer", bornAt);
    assert.equal(starter.inventory.every((asset) => asset.manifest.ownerReceizId === owner && verifyAnyWildsCard(asset).ok), true);
    assert.equal(starter.inventory[0]?.manifest.capturedAt, bornAt);
    assert.equal(starter.inventory[0]?.manifest.variant.generatorVersion, 3);
    assert.match(starter.inventory[0]?.manifest.name ?? "", /^[A-Z][a-z]{1,6}$/);
    assert.doesNotMatch(starter.inventory[0]?.manifest.name ?? "", /flowkin/i);
    assert.equal(starter.selectedCardId, starter.inventory[0]?.manifest.familyId);
    assert.deepEqual(starter.discoveredCardIds, [starter.inventory[0]?.manifest.familyId]);
    assert.notEqual(starter.inventory[0]?.manifest.name, other.inventory[0]?.manifest.name);
    assert.deepEqual(starter.inventory, repeated.inventory);
    assert.notEqual(starter.inventory[0]?.id, other.inventory[0]?.id);
    assert.notEqual(starter.inventory[0]?.manifest.variant.seed, other.inventory[0]?.manifest.variant.seed);
    assert.notEqual(starter.inventory[0]?.manifest.familyId, other.inventory[0]?.manifest.familyId);
    assert.notEqual(starter.inventory[0]?.manifest.name, "SealCub");

    const legacyState = { ...initialPlayState, inventory: undefined, discoveredCardIds: ["mintcub", "voltray"], supportAssetIds: undefined };
    const restored = restorePlayState(JSON.stringify({ schema: "receiz.wilds.save.v2", state: legacyState }), owner);
    assert.equal(restored.inventory.every((asset) => asset.manifest.ownerReceizId === owner && verifyAnyWildsCard(asset).ok), true);
    assert.deepEqual(restored.supportAssetIds, [null, null]);
  });

  it("defaults proximity fields when restoring an older active encounter", () => {
    const envelope = JSON.parse(serializePlayState(initialPlayState));
    envelope.state.encounter = {
      phase: "searching",
      searchedAt: "2026-07-13T15:00:00.000Z",
      ownerReceizId: "player.receiz.id",
      searchPoint: { x: 1, z: 2 }
    };
    const restored = restorePlayState(JSON.stringify(envelope));
    assert.notEqual(restored.encounter.phase, "idle");
    if (restored.encounter.phase !== "idle") {
      assert.equal(restored.encounter.proximity, "cold");
      assert.equal(restored.encounter.trend, null);
    }
  });

  it("restores the exact wild creature visual identity from a saved encounter", () => {
    const hotspots = nearbyHiddenHotspots(initialPlayState.player);
    const hotspot = hotspots[0]!;
    const discovered = applyWildsInput(initialPlayState, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-07-17T12:00:00.000Z",
      ownerReceizId: "player.receiz.id"
    });
    assert.notEqual(discovered.encounter.phase, "idle");
    if (discovered.encounter.phase === "idle" || !discovered.encounter.discoveryIdentity || !discovered.encounter.formId) return;
    const identity = discovered.encounter.discoveryIdentity;
    const canonicalFormId = discovered.encounter.formId;
    const original = projectEncounterCreatureVisualIdentity({
      identity,
      formId: canonicalFormId
    });
    const staleFormId = hotspots.find((candidate) => candidate.familyId !== identity.family.id)!.formId;

    const restored = restorePlayState(serializePlayState({
      ...discovered,
      encounter: { ...discovered.encounter, familyId: "stale-family", formId: staleFormId }
    }));
    assert.notEqual(restored.encounter.phase, "idle");
    if (restored.encounter.phase === "idle" || !restored.encounter.discoveryIdentity || !restored.encounter.formId) return;
    assert.equal(restored.encounter.formId, canonicalFormId);
    assert.equal(restored.encounter.familyId, identity.family.id);
    assert.deepEqual(projectEncounterCreatureVisualIdentity({
      identity: restored.encounter.discoveryIdentity,
      formId: restored.encounter.formId
    }), original);
  });

  it("reconstructs the same wild appearance for a legacy encounter without embedded identity", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player)[0]!;
    const discovered = applyWildsInput(initialPlayState, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-07-17T12:00:00.000Z",
      ownerReceizId: "player.receiz.id"
    });
    assert.notEqual(discovered.encounter.phase, "idle");
    if (discovered.encounter.phase === "idle" || !discovered.encounter.discoveryIdentity || !discovered.encounter.formId) return;
    const original = projectEncounterCreatureVisualIdentity({
      identity: discovered.encounter.discoveryIdentity,
      formId: discovered.encounter.formId
    });
    const envelope = JSON.parse(serializePlayState({
      ...discovered,
      encounter: { ...discovered.encounter, phase: "capsule" }
    }));
    delete envelope.state.encounter.discoveryIdentity;

    const restored = restorePlayState(JSON.stringify(envelope));
    assert.equal(restored.encounter.phase, "capsule");
    if (!restored.encounter.discoveryIdentity || !restored.encounter.formId) return;
    assert.deepEqual(projectEncounterCreatureVisualIdentity({
      identity: restored.encounter.discoveryIdentity,
      formId: restored.encounter.formId
    }), original);
  });

  it("reconstructs identity for every visible legacy encounter phase", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player)[0]!;
    const discovered = applyWildsInput(initialPlayState, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-07-17T12:00:00.000Z",
      ownerReceizId: "player.receiz.id"
    });
    assert.notEqual(discovered.encounter.phase, "idle");
    if (discovered.encounter.phase === "idle" || !discovered.encounter.discoveryIdentity || !discovered.encounter.formId) return;
    const original = projectEncounterCreatureVisualIdentity({
      identity: discovered.encounter.discoveryIdentity,
      formId: discovered.encounter.formId
    });
    const visiblePhases = ["battle_intro", "player_turn", "capture_ready", "fled", "defeated", "emerging", "capsule", "sealed", "revealed"] as const;

    for (const phase of visiblePhases) {
      const envelope = JSON.parse(serializePlayState({
        ...discovered,
        encounter: { ...discovered.encounter, phase }
      }));
      delete envelope.state.encounter.discoveryIdentity;
      const restored = restorePlayState(JSON.stringify(envelope));
      assert.equal(restored.encounter.phase, phase === "sealed" ? "revealed" : phase);
      assert.ok(restored.encounter.discoveryIdentity, `${phase}: discovery identity must be reconstructed`);
      assert.ok(restored.encounter.formId, `${phase}: canonical form must be reconstructed`);
      assert.deepEqual(projectEncounterCreatureVisualIdentity({
        identity: restored.encounter.discoveryIdentity,
        formId: restored.encounter.formId
      }), original, phase);
    }
  });

  it("reconstructs a missing discovery identity and completes capture after refresh", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player)[0]!;
    const envelope = JSON.parse(serializePlayState(initialPlayState));
    envelope.state.encounter = {
      phase: "capsule",
      searchedAt: "2026-07-17T12:00:00.000Z",
      ownerReceizId: "player.receiz.id",
      searchPoint: { ...hotspot.position },
      hotspotId: hotspot.id,
      familyId: hotspot.familyId,
      formId: hotspot.formId,
      cover: hotspot.cover,
      proximity: "hot",
      trend: null
    };

    const restored = restorePlayState(JSON.stringify(envelope));
    assert.equal(restored.encounter.phase, "capsule");
    assert.ok(restored.encounter.discoveryIdentity);

    const sealed = applyWildsInput(restored, { type: "advance-encounter", at: "2026-07-17T12:00:08.000Z" });
    assert.equal(sealed.encounter.phase, "sealed");
    assert.equal(sealed.inventory.length, initialPlayState.inventory.length + 1);
    assert.equal(verifyPortableCard(sealed.inventory.at(-1)!).ok, true);
  });

  it("completes a runtime capture atomically when its discovery identity must be reconstructed", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player)[0]!;
    const broken: PlayState = {
      ...initialPlayState,
      encounter: {
        phase: "capsule",
        searchedAt: "2026-07-17T12:00:00.000Z",
        ownerReceizId: "player.receiz.id",
        searchPoint: { ...hotspot.position },
        hotspotId: hotspot.id,
        familyId: hotspot.familyId,
        formId: hotspot.formId,
        cover: hotspot.cover,
        proximity: "hot",
        trend: null
      }
    };

    const recovered = applyWildsInput(broken, { type: "advance-encounter", at: "2026-07-17T12:00:08.000Z" });
    assert.equal(recovered.encounter.phase, "sealed");
    assert.equal(recovered.inventory.length, initialPlayState.inventory.length + 1);
    assert.equal(recovered.capturedHotspotIds.includes(hotspot.id), true);
    assert.equal(verifyPortableCard(recovered.inventory.at(-1)!).ok, true);
  });

  it("restores and seals a first-generation permanent identity without renaming it", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player)[0]!;
    const discovered = applyWildsInput(initialPlayState, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-07-17T12:00:00.000Z",
      ownerReceizId: "player.receiz.id"
    });
    assert.notEqual(discovered.encounter.phase, "idle");
    if (discovered.encounter.phase === "idle" || !discovered.encounter.discoveryIdentity) return;
    const historicalIdentity = structuredClone(discovered.encounter.discoveryIdentity);
    historicalIdentity.name = {
      given: "Brikano",
      epithet: "Tanobaki",
      display: "Brikano Tanobaki",
      collisionLane: 0
    };
    historicalIdentity.identityDigest = livingCreatureIdentityDigest(historicalIdentity);
    const capsule: PlayState = {
      ...discovered,
      encounter: { ...discovered.encounter, phase: "capsule", discoveryIdentity: historicalIdentity }
    };

    const restored = restorePlayState(serializePlayState(capsule));
    assert.equal(restored.encounter.phase, "capsule");
    assert.equal(restored.encounter.discoveryIdentity?.name.display, "Brikano Tanobaki");

    const sealed = applyWildsInput(restored, { type: "advance-encounter", at: "2026-07-17T12:00:08.000Z" });
    assert.equal(sealed.encounter.phase, "sealed");
    assert.equal(sealed.inventory.at(-1)?.manifest.name, "Brikano Tanobaki");
    assert.equal(verifyPortableCard(sealed.inventory.at(-1)!).ok, true);
  });

  it("seals the permanent identity after a restored owner handle changes", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player)[0]!;
    const discovered = applyWildsInput(initialPlayState, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-07-17T12:00:00.000Z",
      ownerReceizId: "original-owner"
    });
    assert.notEqual(discovered.encounter.phase, "idle");
    if (discovered.encounter.phase === "idle" || !discovered.encounter.discoveryIdentity) return;
    const identity = discovered.encounter.discoveryIdentity;
    const migrated: PlayState = {
      ...discovered,
      encounter: { ...discovered.encounter, phase: "capsule", ownerReceizId: "renamed-owner" }
    };

    const sealed = applyWildsInput(migrated, { type: "advance-encounter", at: "2026-07-17T12:00:08.000Z" });
    assert.equal(sealed.encounter.phase, "sealed");
    assert.equal(sealed.inventory.at(-1)?.manifest.name, identity.name.display);
    assert.equal(sealed.inventory.at(-1)?.manifest.ownerReceizId, identity.discovery.ownerScope);
    assert.equal(verifyPortableCard(sealed.inventory.at(-1)!).ok, true);
  });

  it("seals the permanent identity using its discovered form after encounter metadata drifts", () => {
    const hotspots = nearbyHiddenHotspots(initialPlayState.player);
    const hotspot = hotspots[0]!;
    const discovered = applyWildsInput(initialPlayState, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-07-17T12:00:00.000Z",
      ownerReceizId: "player.receiz.id"
    });
    assert.notEqual(discovered.encounter.phase, "idle");
    if (discovered.encounter.phase === "idle" || !discovered.encounter.discoveryIdentity || !discovered.encounter.formId) return;
    const identity = discovered.encounter.discoveryIdentity;
    const other = hotspots.find((candidate) => candidate.familyId !== identity.family.id)!;
    const migrated: PlayState = {
      ...discovered,
      encounter: {
        ...discovered.encounter,
        phase: "capsule",
        familyId: other.familyId,
        formId: other.formId,
        cover: other.cover
      }
    };

    const sealed = applyWildsInput(migrated, { type: "advance-encounter", at: "2026-07-17T12:00:08.000Z" });
    assert.equal(sealed.encounter.phase, "sealed");
    assert.equal(sealed.inventory.at(-1)?.manifest.name, identity.name.display);
    assert.equal(sealed.inventory.at(-1)?.manifest.familyId, identity.family.id);
    assert.equal(verifyPortableCard(sealed.inventory.at(-1)!).ok, true);
  });

  it("migrates a v2 discovery save into sealed portable inventory", () => {
    const legacy = JSON.stringify({
      schema: "receiz.wilds.save.v2",
      state: { ...initialPlayState, inventory: undefined, pendingSyncAssetIds: undefined, discoveredCardIds: ["mintcub", "voltray"] }
    });
    const restored = restorePlayState(legacy);

    assert.equal(restored.inventory.some((asset) => asset.manifest.formId === "mintcub-1"), true);
    assert.equal(restored.inventory.some((asset) => asset.manifest.formId === "voltray-1"), true);
    assert.equal(restored.inventory.every((asset) => verifyAnyWildsCard(asset).ok), true);
    assert.equal(restored.inventory.every((asset) => isLivingCardAsset(asset)), true);
  });

  it("migrates v4 saves with safe living-growth and bond-cooldown defaults", () => {
    const legacyState = { ...initialPlayState } as Partial<PlayState> & Record<string, unknown>;
    delete legacyState.livingProgress;
    delete legacyState.ascensionCatalysts;
    delete legacyState.transformation;
    delete legacyState.bondCooldowns;
    const restored = restorePlayState(JSON.stringify({ schema: "receiz.wilds.save.v4", state: legacyState }));

    assert.deepEqual(restored.bondCooldowns, {});
    assert.equal(Boolean(restored.livingProgress[restored.selectedAssetId]), true);
  });

  it("merges duplicate stable ids to the newest valid living chain during restore", () => {
    const legacy = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "wilds.player.receiz.id", encounterId: "restore-merge", capturedAt: "2026-07-10T12:00:00.000Z" });
    const living = evolvePortableCard({ previous: legacy, nextFormId: "mintcub-2", evolvedAt: "2026-07-11T12:00:00.000Z" });
    const envelope = JSON.parse(serializePlayState(initialPlayState));
    envelope.state.inventory = [legacy, living];
    envelope.state.discoveredCardIds = ["mintcub"];
    envelope.state.selectedAssetId = legacy.id;
    const restored = restorePlayState(JSON.stringify(envelope));

    assert.equal(restored.inventory.filter((asset) => asset.id === legacy.id).length, 1);
    assert.equal(restored.inventory.find((asset) => asset.id === legacy.id)?.manifest.formId, "mintcub-2");
  });

  it("supports continuous analog travel across a billion-unit world", () => {
    const moved = applyWildsInput(initialPlayState, { type: "move-vector", x: 0.8, z: -0.6 });
    const edgeState: PlayState = {
      ...initialPlayState,
      player: { x: 499_999_999.9, z: -499_999_999.9 }
    };
    const clamped = applyWildsInput(edgeState, { type: "move-vector", x: 1, z: -1 });

    assert.ok(moved.player.x > initialPlayState.player.x);
    assert.ok(moved.player.z < initialPlayState.player.z);
    assert.equal(clamped.player.x, 500_000_000);
    assert.equal(clamped.player.z, -500_000_000);
  });

  it("slides ordinary movement against visible physical authority without changing the save schema", () => {
    const physical = wildsTerrainObstaclesForTile(-20, -20).find((obstacle) => obstacle.material === "solid")!;
    const capsuleRadius = 0.38;
    const boundary = physical.position.x - physical.radius - capsuleRadius;
    const ready: PlayState = {
      ...structuredClone(initialPlayState),
      player: { x: boundary - 0.2, z: physical.position.z }
    };
    const moved = applyWildsInput(ready, { type: "move-vector", x: 1, z: 0, mode: "walk" });
    const restored = restorePlayState(serializePlayState(moved));

    assert.ok(moved.player.x > ready.player.x);
    assert.ok(moved.player.x <= boundary + 0.000001);
    assert.deepEqual(restored.player, moved.player);
    assert.deepEqual(Object.keys(restored.player).sort(), ["x", "z"]);
  });

  it("uses the selected admitted creature capability for local swimming without reverification", () => {
    const tide = sealCollectedCard({
      formId: "ledgerfox-1",
      ownerReceizId: "wilds.player.receiz.id",
      encounterId: "movement-swimmer",
      capturedAt: "2026-08-21T12:00:00.000Z"
    });
    const blocked = applyWildsInput({ ...structuredClone(initialPlayState), player: { x: -94.42, z: -240 } }, { type: "move-vector", x: 1, z: 0 });
    const imported = applyWildsInput(initialPlayState, { type: "import-card", asset: tide });
    const selected = applyWildsInput(imported, { type: "select-asset", assetId: tide.id });
    const swimming = applyWildsInput({ ...selected, player: { x: -94.42, z: -240 }, adventureConditions: { ...selected.adventureConditions, [tide.id]: { ...selected.adventureConditions[tide.id]!, xp: { swim: 100 } } } }, { type: "move-vector", x: 1, z: 0 });

    assert.deepEqual(blocked.player, { x: -94.42, z: -240 });
    assert.ok(swimming.player.x > -94.42);
    assert.match(swimming.lastEvent, /swimming/i);
    assert.deepEqual(Object.keys(swimming.player).sort(), ["x", "z"]);
  });

  it("admits aerial terrain crossing only when the selected creature has that exact capability", () => {
    const winged = sealCollectedCard({
      formId: "voltray-1",
      ownerReceizId: "wilds.player.receiz.id",
      encounterId: "movement-flight",
      capturedAt: "2026-08-21T12:05:00.000Z"
    });
    const ordinary = applyWildsInput({ ...structuredClone(initialPlayState), player: { x: -94.42, z: -240 } }, {
      type: "move-vector", x: 1, z: 0, aerialMode: "flight"
    });
    const imported = applyWildsInput(initialPlayState, { type: "import-card", asset: winged });
    const selected = applyWildsInput(imported, { type: "select-asset", assetId: winged.id });
    const flying = applyWildsInput({ ...selected, player: { x: -94.42, z: -240 }, adventureConditions: { ...selected.adventureConditions, [winged.id]: { ...selected.adventureConditions[winged.id]!, xp: { flight: 400 } } } }, {
      type: "move-vector", x: 1, z: 0, aerialMode: "flight"
    });

    assert.deepEqual(ordinary.player, { x: -94.42, z: -240 });
    assert.ok(flying.player.x > -94.42);
    assert.match(flying.lastEvent, /flying/i);
  });
});
