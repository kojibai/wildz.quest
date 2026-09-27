import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialPlayState, restorePlayState, serializePlayState, upgradeV10PlayStateToV11 } from "../src/features/play/game-state";
import { wildsWorldRegionForAddressV11 } from "../src/features/play/wilds-world-service";
import { createWildsBlueprintAnchorV11 } from "../src/features/play/wilds-world-construction";
import { wildsExcavationWorldIdForAddressV11 } from "../src/features/play/wilds-excavation";
import { projectWildsResourceRegionV11 } from "../src/features/play/wilds-resource-authority";
import {
  createInitialWildsExplorationAtlasV11,
  normalizeWildsExplorationAtlasV11,
  revealWildsExplorationAtV11,
  wildsExplorationContainsRegionV11
} from "../src/features/play/wilds-exploration-atlas";

const far = { worldVersion: 11, regionX: "9007199254740993", regionZ: "-9007199254740993", localX: 7_000_000, localZ: 19_000_000 } as const;

describe("v11 world save continuity", () => {
  it("upgrades a v10 numeric location exactly without changing its legacy card", () => {
    const old = { ...initialPlayState, player: { x: -2.15, z: -0.85 } };
    const priorCard = old.inventory[0];
    const upgraded = upgradeV10PlayStateToV11(old);
    assert.deepEqual(upgraded.worldAddress, { worldVersion: 11, regionX: "-1", regionZ: "-1", localX: 21_850_000, localZ: 23_150_000 });
    assert.deepEqual(upgraded.inventory[0], priorCard);
    assert.equal(JSON.parse(serializePlayState(upgraded)).schema, "receiz.wilds.save.v11");
  });

  it("round-trips a distant exact address without losing its sparse atlas", () => {
    const upgraded = upgradeV10PlayStateToV11(initialPlayState);
    const state = { ...upgraded, worldAddress: far, player: { x: 7, z: 19 }, explorationAtlasV11: revealWildsExplorationAtV11(upgraded.explorationAtlasV11!, far) };
    const restored = restorePlayState(serializePlayState(state));
    assert.deepEqual(restored.worldAddress, far);
    assert.equal(restored.player.x, 7);
    assert.equal(wildsExplorationContainsRegionV11(restored.explorationAtlasV11!, far.regionX, far.regionZ), true);
    assert.equal(restored.explorationAtlasV11!.regions.length, upgraded.explorationAtlasV11!.regions.length + 9);
  });

  it("does not allocate intervening regions for distant discoveries", () => {
    const initial = createInitialWildsExplorationAtlasV11();
    const revealed = revealWildsExplorationAtV11(initial, far);
    assert.equal(revealed.regions.length, initial.regions.length + 9);
    assert.equal(wildsExplorationContainsRegionV11(revealed, "0", "0"), true);
    assert.equal(wildsExplorationContainsRegionV11(revealed, "4503599627370496", "0"), false);
    assert.deepEqual(normalizeWildsExplorationAtlasV11(revealed), revealed);
  });

  it("keeps construction, resource, and excavation anchors on the restored exact region", () => {
    const state = restorePlayState(serializePlayState({
      ...upgradeV10PlayStateToV11(initialPlayState), worldAddress: far, player: { x: 7, z: 19 }
    }));
    const address = state.worldAddress!;
    assert.equal(wildsWorldRegionForAddressV11(address).key, `wildz.region.v11:${far.regionX}:${far.regionZ}`);
    assert.equal(createWildsBlueprintAnchorV11("foundation", address).address.regionX, far.regionX);
    assert.equal(wildsExcavationWorldIdForAddressV11(address), `wildz.excavation.region.v11:${far.regionX}:${far.regionZ}`);
    assert.equal(projectWildsResourceRegionV11(far.regionX, far.regionZ)[0]!.address.regionZ, far.regionZ);
  });

  it("rejects a malformed v11 address rather than relocating the explorer", () => {
    const state = upgradeV10PlayStateToV11(initialPlayState);
    const envelope = JSON.parse(serializePlayState(state));
    envelope.state.worldAddress.regionX = "01";
    assert.throws(() => restorePlayState(JSON.stringify(envelope)), /v11.*address|address.*invalid/i);
  });
});
