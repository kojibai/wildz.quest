import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyWildsInput,
  canDiscover,
  initialPlayState,
  restorePlayState,
  serializePlayState,
  type PlayState
} from "../src/features/play/game-state";
import { admitLegacyCard, currentRevision, emptyLivingGrowth } from "../src/features/play/living-card-proof.js";
import { nextGrowthRequirements } from "../src/features/play/growth-engine.js";
import { evolvePortableCard, sealCollectedCard, verifyAnyWildsCard, verifyPortableCard } from "../src/features/play/portable-card.js";
import { nearbyHiddenHotspots } from "../src/features/play/hidden-hotspots.js";
import { isLivingCardAsset } from "../src/features/play/living-card-types.js";

describe("Receiz Wilds game state", () => {
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
    assert.equal(currentRevision(fused.inventory[0] as ReturnType<typeof admitLegacyCard>).childEventIds.length, 1);
    assert.equal(currentRevision(fused.inventory[1] as ReturnType<typeof admitLegacyCard>).childEventIds.length, 1);
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

    const sealed = applyWildsInput(capsule, { type: "advance-encounter", at: "2026-07-13T15:00:02.000Z" });
    assert.equal(sealed.encounter.phase, "sealed");
    assert.equal(sealed.inventory.length, initialPlayState.inventory.length + 1);
    assert.equal(sealed.capturedHotspotIds.includes(hotspot.id), true);
    assert.equal(verifyPortableCard(sealed.inventory.at(-1)!).ok, true);

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

  it("turns mission completion into a portable merchant reward card", () => {
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
    assert.equal(next.rewardCards.length, 1);
    assert.match(next.rewardCards[0].businessUse, /coupon/);
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
    assert.match(state.lastEvent, /Level 2/);
  });

  it("records active travel only when the leading card crosses a bounded milestone", () => {
    const ready: PlayState = { ...initialPlayState, player: { x: 7.9, z: 0 } };
    const crossed = applyWildsInput(ready, { type: "move", direction: "east" });
    const within = applyWildsInput(crossed, { type: "move-vector", x: 0.2, z: 0 });

    assert.equal(crossed.livingProgress[ready.selectedAssetId]!.paths.bond, ready.livingProgress[ready.selectedAssetId]!.paths.bond + 1);
    assert.equal(within.livingProgress[ready.selectedAssetId]!.paths.bond, crossed.livingProgress[ready.selectedAssetId]!.paths.bond);
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
});
