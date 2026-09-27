import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyWildsInput, initialPlayState, restorePlayState, serializePlayState,
  upgradeV10PlayStateToV11 } from "../src/features/play/game-state";
import { generateWildsRegionV11, wildsRegionGeneratorV11CacheSize } from "../src/features/play/wilds-region-generator-v11";
import { observationPointV11, observeWildsSiteV11 } from "../src/features/play/wilds-site-search-v11";

const regionX = "9007199254740993";
const regionZ = "-9007199254740993";

describe("v11 exact-address site scanning", () => {
  it("finds a generated site in an arbitrarily distant region without a v10 hotspot", () => {
    const generated = generateWildsRegionV11(regionX, regionZ).encounterSites[0]!;
    const address = { worldVersion: 11, regionX, regionZ, localX: generated.localX, localZ: generated.localZ } as const;
    assert.deepEqual(observeWildsSiteV11(address), { kind: "site", site: address, slot: 0, distanceMicro: 0n });
    const state = { ...upgradeV10PlayStateToV11(initialPlayState), worldAddress: address,
      worldCoordinateMode: "region-local" as const, player: { x: generated.localX / 1_000_000, z: generated.localZ / 1_000_000 } };
    const searched = applyWildsInput(state, { type: "search-point", ...state.player,
      searchedAt: "2026-09-26T12:00:00.000Z", ownerReceizId: "player.test" });
    assert.equal(searched.encounter.phase, "idle");
    assert.match(searched.lastEvent, /creature remains unknown until the encounter is admitted/);
    assert.equal(searched.inventory.length, state.inventory.length);
    assert.deepEqual(searched.pendingEncounterSitesV11?.pending, [{ actorId: "player.test", site: address, slot: 0 }]);
    const repeated = applyWildsInput(searched, { type: "search-point", ...state.player,
      searchedAt: "2026-09-26T12:00:01.000Z", ownerReceizId: "player.test" });
    assert.equal(repeated.pendingEncounterSitesV11?.pending.length, 1);
    const restored = restorePlayState(serializePlayState(repeated), "player.test");
    assert.deepEqual(restored.pendingEncounterSitesV11?.pending, repeated.pendingEncounterSitesV11?.pending);
    assert.equal(restorePlayState(serializePlayState(repeated), "other.player").pendingEncounterSitesV11?.pending.length, 0);
  });

  it("projects a nearby search point across a region edge with exact coordinates", () => {
    const site = generateWildsRegionV11(regionX, regionZ).encounterSites[0]!;
    const address = { worldVersion: 11, regionX, regionZ, localX: site.localX, localZ: site.localZ } as const;
    const playerAddress = { ...address, localX: 23_900_000 };
    const player = { x: 23.9, z: site.localZ / 1_000_000 };
    assert.deepEqual(observationPointV11(playerAddress, player, { x: 24.1, z: player.z }),
      { ...playerAddress, regionX: (BigInt(regionX) + 1n).toString(), localX: 100_000 });
    const near = observeWildsSiteV11({ ...address, localX: Math.min(site.localX + 2_000_000, 23_999_999) });
    assert.ok(near.kind === "near" || near.kind === "site");
    assert.ok(wildsRegionGeneratorV11CacheSize() <= 128);
  });
});
