import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { creatureForm } from "../src/features/play/creature-catalog";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import {
  hotspotsForRegion,
  nearbyHiddenHotspots,
  searchHiddenHotspots,
  wildsHotspotProjectionDiagnostics,
  wildsHotspotRegionCacheSize
} from "../src/features/play/hidden-hotspots";
import {
  isWildsAquaticForm,
  selectWildsHabitatForm
} from "../src/features/play/wilds-creature-habitat";
import { sampleWildsTerrain, type WildsTerrainSurface } from "../src/features/play/wilds-terrain-authority";

const waterSurfaces = new Set<WildsTerrainSurface>(["shallow-water", "deep-water"]);

function hasReachableWaterPoint(hotspot: { position: { x: number; z: number } }) {
  for (let dz = -1.15; dz <= 1.15; dz += 0.1) {
    for (let dx = -1.15; dx <= 1.15; dx += 0.1) {
      if (Math.hypot(dx, dz) > 1.15) continue;
      if (sampleWildsTerrain(hotspot.position.x + dx, hotspot.position.z + dz).surface !== "deep-water") return true;
    }
  }
  return false;
}

function reachablePoint(hotspot: { position: { x: number; z: number } }) {
  for (let dz = -1.15; dz <= 1.15; dz += 0.1) {
    for (let dx = -1.15; dx <= 1.15; dx += 0.1) {
      if (Math.hypot(dx, dz) > 1.15) continue;
      const point = { x: hotspot.position.x + dx, z: hotspot.position.z + dz };
      if (sampleWildsTerrain(point.x, point.z).surface !== "deep-water") return point;
    }
  }
  return null;
}

describe("Wildz terrain-authorized creature habitat", () => {
  it("keeps aquatic and land form selection in strict physical partitions", () => {
    for (const surface of ["shallow-water", "deep-water"] as const) {
      for (const seed of [0, 0.17, 0.42, 0.99]) {
        assert.equal(isWildsAquaticForm(selectWildsHabitatForm(surface, seed)), true);
      }
    }
    for (const surface of ["trail", "soil", "grass", "rock", "sand"] as const) {
      for (const seed of [0, 0.17, 0.42, 0.99]) {
        assert.equal(isWildsAquaticForm(selectWildsHabitatForm(surface, seed)), false);
      }
    }
  });

  it("places every hotspot on terrain matching its admitted creature partition", () => {
    for (const region of [{ x: 0, z: 0 }, { x: -4, z: -10 }, { x: 4, z: -12 }, { x: 3, z: -11 }]) {
      for (const hotspot of hotspotsForRegion(region.x, region.z)) {
        const surface = sampleWildsTerrain(hotspot.position.x, hotspot.position.z).surface;
        assert.equal(hotspot.cover === "water", waterSurfaces.has(surface), hotspot.id);
        assert.equal(isWildsAquaticForm(creatureForm(hotspot.formId)!), waterSurfaces.has(surface), hotspot.id);
      }
    }
  });

  it("provides an actually reachable aquatic signal around representative deep-water clusters", () => {
    for (const center of [{ x: -4, z: -10 }, { x: 4, z: -12 }, { x: 3, z: -11 }]) {
      const hotspots = [];
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) hotspots.push(...hotspotsForRegion(center.x + dx, center.z + dz));
      }
      const reachable = hotspots.filter((hotspot) => hotspot.cover === "water" && hotspot.shoreReachable);
      assert.ok(reachable.length > 0, `${center.x}:${center.z}`);
      assert.ok(reachable.some(hasReachableWaterPoint), `${center.x}:${center.z}`);
    }
  });

  it("never labels deep-water hotspots shore reachable beyond the actual hit radius", () => {
    for (let regionZ = -16; regionZ <= 16; regionZ += 1) {
      for (let regionX = -16; regionX <= 16; regionX += 1) {
        for (const hotspot of hotspotsForRegion(regionX, regionZ)) {
          if (!hotspot.shoreReachable || sampleWildsTerrain(hotspot.position.x, hotspot.position.z).surface !== "deep-water") continue;
          assert.equal(hasReachableWaterPoint(hotspot), true, hotspot.id);
        }
      }
    }
  });

  it("lets a shore explorer catch an aquatic creature and use that exact card to swim", () => {
    const hotspots = [];
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) hotspots.push(...hotspotsForRegion(-4 + dx, -10 + dz));
    }
    const hotspot = hotspots.find((candidate) => candidate.cover === "water" && candidate.shoreReachable)!;
    const shore = reachablePoint(hotspot)!;
    assert.ok(Math.hypot(shore.x - hotspot.position.x, shore.z - hotspot.position.z) <= hotspot.hitRadius);
    assert.notEqual(sampleWildsTerrain(shore.x, shore.z).surface, "deep-water");
    let state = applyWildsInput({ ...structuredClone(initialPlayState), player: shore }, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-08-21T12:00:00.000Z",
      ownerReceizId: "wilds.aquatic.player"
    });
    assert.equal(state.encounter.phase, "battle_intro");
    if (!state.encounter.formId) return;
    assert.equal(isWildsAquaticForm(creatureForm(state.encounter.formId)!), true);

    state = applyWildsInput(state, { type: "start-battle", at: "2026-08-21T12:00:01.000Z" });
    for (let turn = 0; turn < 20 && state.encounter.phase === "player_turn"; turn += 1) {
      state = applyWildsInput(state, {
        type: "battle-action",
        action: state.battle!.player.energy >= 12 ? { type: "ability", slot: 0 } : { type: "guard" }
      });
    }
    assert.equal(state.encounter.phase, "capture_ready");
    for (let attempt = 0; attempt < 5 && state.encounter.phase === "capture_ready"; attempt += 1) {
      state = applyWildsInput(state, { type: "battle-action", action: { type: "capture" } });
    }
    assert.equal(state.encounter.phase, "capsule");
    state = applyWildsInput(state, { type: "advance-encounter", at: "2026-08-21T12:00:02.000Z" });
    const aquatic = state.inventory.at(-1)!;
    assert.equal(isWildsAquaticForm(creatureForm(aquatic.manifest.formId)!), true);
    state = applyWildsInput(state, { type: "select-asset", assetId: aquatic.id });
    state = { ...state, adventureConditions: { ...state.adventureConditions, [aquatic.id]: { ...(state.adventureConditions[aquatic.id] ?? emptyAdventureCondition(aquatic.id)), xp: { swim: 100 } } } };
    const deepWater = { ...state, player: { x: -94.42, z: -240 } };
    const swimming = applyWildsInput(deepWater, { type: "move-vector", x: 1, z: 0 });
    assert.ok(swimming.player.x > deepWater.player.x);
    assert.match(swimming.lastEvent, /swimming/i);
  });

  it("builds a bounded immutable region projection once and reuses it", () => {
    const before = wildsHotspotProjectionDiagnostics();
    const first = hotspotsForRegion(70_123, -81_337);
    const built = wildsHotspotProjectionDiagnostics();
    const second = hotspotsForRegion(70_123, -81_337);
    const reused = wildsHotspotProjectionDiagnostics();

    assert.equal(built.regionsBuilt - before.regionsBuilt, 1);
    assert.equal(built.terrainSamples - before.terrainSamples, 36);
    assert.equal(second, first);
    assert.deepEqual(reused, built);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(first.every((hotspot) => Object.isFrozen(hotspot) && Object.isFrozen(hotspot.position)), true);
  });

  it("limits an initial nearby scan to nine fixed candidate projections and memoizes repeats", () => {
    const point = { x: 8_400_120, z: -7_300_144 };
    const before = wildsHotspotProjectionDiagnostics();
    nearbyHiddenHotspots(point);
    const built = wildsHotspotProjectionDiagnostics();
    nearbyHiddenHotspots(point);
    const reused = wildsHotspotProjectionDiagnostics();

    assert.equal(built.regionsBuilt - before.regionsBuilt, 9);
    assert.equal(built.terrainSamples - before.terrainSamples, 324);
    assert.deepEqual(reused, built);
  });

  it("keeps cache memory bounded and regenerates evicted regions deterministically", () => {
    const expected = structuredClone(hotspotsForRegion(91_001, -92_001));
    for (let index = 0; index < 150; index += 1) hotspotsForRegion(92_000 + index, -93_000 - index);
    assert.ok(wildsHotspotRegionCacheSize() <= 128);
    assert.deepEqual(hotspotsForRegion(91_001, -92_001), expected);
  });

  it("recognizes legacy family-suffixed capture ids by stable region slot", () => {
    const hotspot = hotspotsForRegion(17, -19)[0]!;
    const legacyId = `hotspot:${hotspot.regionX}:${hotspot.regionZ}:0:legacy-family`;
    const result = searchHiddenHotspots([hotspot], hotspot.position, [legacyId]);
    assert.equal(result.kind, "captured");
  });

  it("does no hotspot projection or terrain sampling during ordinary movement", () => {
    const before = wildsHotspotProjectionDiagnostics();
    let state = structuredClone(initialPlayState);
    for (let index = 0; index < 300; index += 1) {
      state = applyWildsInput(state, { type: "move-vector", x: index % 2 === 0 ? 1 : -1, z: 0 });
    }
    assert.deepEqual(wildsHotspotProjectionDiagnostics(), before);
  });
});
