import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hotspotsForRegion,
  searchHiddenHotspots,
  wildsHotspotProjectionDiagnostics,
  type HiddenHotspot
} from "../src/features/play/hidden-hotspots";
import {
  projectWildsLayeredEncounter,
  writeWildsEncounterActorOuterFrame,
  wildsEncounterActorLocomotion,
  wildsEncounterActorOffsetY,
  wildsLayeredEncounterCacheSize,
  wildsLayeredEncounterDiagnostics,
  type WildsEncounterSearchContext
} from "../src/features/play/wilds-layered-encounters";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import { WILDS_WATERLINE_ELEVATION } from "../src/features/play/wilds-terrain-rendering";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { projectWildsCreatureLocomotionFrame } from "../src/features/play/WildsCreatureActor";

describe("deterministic layered Wilds encounters", () => {
  it("regenerates the exact layer and world height after bounded cache eviction at extreme coordinates", () => {
    const input = {
      regionX: 20_000_001,
      regionZ: -19_999_999,
      slot: 5,
      position: { x: 480_000_031.25, z: -479_999_971.75 },
      surface: "deep-water" as const,
      shoreReachable: false
    };
    const expected = structuredClone(projectWildsLayeredEncounter(input));
    const zero = projectWildsLayeredEncounter({ ...input, regionX: 0 });
    const aliased = projectWildsLayeredEncounter({ ...input, regionX: 4_294_967_296 });
    for (let index = 0; index < 180; index += 1) projectWildsLayeredEncounter({
      regionX: 20_100_000 + index,
      regionZ: -20_100_000 - index,
      slot: index % 6,
      position: { x: 482_400_001 + index * 24, z: -482_400_001 - index * 24 },
      surface: index % 2 ? "grass" : "deep-water",
      shoreReachable: false
    });

    assert.ok(wildsLayeredEncounterCacheSize() <= 128);
    assert.deepEqual(projectWildsLayeredEncounter(input), expected);
    assert.notEqual(aliased.identity, zero.identity);
    assert.ok(Number.isFinite(expected.worldY));
  });

  it("anchors ground and surface actors to their exact shared physical authorities", () => {
    const groundInput = {
      regionX: 91_001,
      regionZ: -91_001,
      slot: 2,
      position: { x: 2_184_031.25, z: -2_184_019.75 },
      surface: "grass" as const,
      shoreReachable: false
    };
    let ground = projectWildsLayeredEncounter(groundInput);
    for (let salt = 0; ground.layer !== "ground" && salt < 64; salt += 1) {
      ground = projectWildsLayeredEncounter({ ...groundInput, slot: 10 + salt });
    }
    const surface = projectWildsLayeredEncounter({
      ...groundInput,
      slot: 73,
      surface: "shallow-water",
      shoreReachable: true
    });

    assert.equal(ground.layer, "ground");
    assert.equal(ground.worldY, Math.round(sampleWildsTerrain(ground.x, ground.z).elevation * 1_000_000) / 1_000_000);
    assert.equal(surface.layer, "surface");
    assert.equal(surface.worldY, WILDS_WATERLINE_ELEVATION);
  });

  it("uses swimming motion for every water actor and ground motion elsewhere", () => {
    assert.equal(wildsEncounterActorLocomotion("surface"), "swim");
    assert.equal(wildsEncounterActorLocomotion("water-column"), "swim");
    assert.equal(wildsEncounterActorLocomotion("seabed"), "swim");
    assert.equal(wildsEncounterActorLocomotion("ground"), "ground");
    assert.equal(wildsEncounterActorLocomotion("air"), "air");
  });

  it("gives aerial actors a real flight pose and a stable reduced-motion hover", () => {
    const flying = projectWildsCreatureLocomotionFrame({
      locomotion: "air",
      timeSeconds: 1,
      motionScale: 1,
      marking: .25,
      pose: "idle"
    });
    const later = projectWildsCreatureLocomotionFrame({
      locomotion: "air",
      timeSeconds: 2,
      motionScale: 1,
      marking: .25,
      pose: "idle"
    });
    const reduced = projectWildsCreatureLocomotionFrame({
      locomotion: "air",
      timeSeconds: 1,
      motionScale: 0,
      marking: .25,
      pose: "idle"
    });
    const reducedLater = projectWildsCreatureLocomotionFrame({
      locomotion: "air",
      timeSeconds: 7,
      motionScale: 0,
      marking: .25,
      pose: "idle"
    });

    assert.ok(flying.rootPitch < -.15);
    assert.notEqual(flying.wingAngle, 0);
    assert.notEqual(flying.rootY, later.rootY);
    assert.deepEqual(reduced, reducedLater);
    assert.ok(reduced.rootPitch < -.15);
    assert.equal(projectWildsCreatureLocomotionFrame({ locomotion: "ground", timeSeconds: 1, motionScale: 1, marking: .25, pose: "idle" }).wingAngle, 0);
    assert.equal(wildsEncounterActorOffsetY("air", 1, 4), 0);
    assert.equal(wildsEncounterActorOffsetY("air", 7, 4), 0);
    assert.notEqual(wildsEncounterActorOffsetY("ground", 1, 4), wildsEncounterActorOffsetY("ground", 2, 4));
  });

  it("keeps the complete aerial encounter group still when reduced motion is enabled", () => {
    const outerGroup = { position: { y: 99 }, rotation: { y: 99 } };
    for (let frame = 0; frame < 300; frame += 1) {
      assert.equal(writeWildsEncounterActorOuterFrame(outerGroup, "air", frame / 60, 4, 7, 0), outerGroup);
    }
    assert.deepEqual(outerGroup, { position: { y: 0 }, rotation: { y: 0 } });

    writeWildsEncounterActorOuterFrame(outerGroup, "air", 1, 4, 7, 1);
    assert.notEqual(outerGroup.rotation.y, 0);
  });

  it("keeps every shore-reachable first swimmer on the surface without a swim requirement", () => {
    let found = 0;
    for (let regionZ = -16; regionZ <= 16; regionZ += 1) for (let regionX = -16; regionX <= 16; regionX += 1) {
      for (const hotspot of hotspotsForRegion(regionX, regionZ)) {
        if (hotspot.cover !== "water" || !hotspot.shoreReachable) continue;
        found += 1;
        assert.equal(hotspot.layer, "surface", hotspot.id);
        assert.equal(hotspot.requiredCapability, null, hotspot.id);
      }
    }
    assert.ok(found > 0);
  });

  it("offers low aerial discoveries before powered flight and gates only high air with flight", () => {
    const aerial = [] as HiddenHotspot[];
    for (let regionZ = -12; regionZ <= 12; regionZ += 1) for (let regionX = -12; regionX <= 12; regionX += 1) {
      aerial.push(...hotspotsForRegion(regionX, regionZ).filter((hotspot) => hotspot.layer === "air"));
    }
    const early = aerial.find((hotspot) => hotspot.requiredCapability === null);
    const high = aerial.find((hotspot) => hotspot.requiredCapability === "flight");
    assert.ok(early);
    assert.ok(high);
    assert.ok(early.worldY - sampleWildsTerrain(early.position.x, early.position.z).elevation <= 1.8);
    assert.ok(high.worldY - sampleWildsTerrain(high.position.x, high.position.z).elevation >= 4);
  });

  it("requires an admitted swimmer for water-column and seabed discoveries", () => {
    const submerged = [] as HiddenHotspot[];
    for (let regionZ = -18; regionZ <= 18; regionZ += 1) for (let regionX = -18; regionX <= 18; regionX += 1) {
      submerged.push(...hotspotsForRegion(regionX, regionZ).filter((hotspot) => hotspot.layer === "water-column" || hotspot.layer === "seabed"));
    }
    assert.ok(submerged.some((hotspot) => hotspot.layer === "water-column"));
    assert.ok(submerged.some((hotspot) => hotspot.layer === "seabed"));
    assert.equal(submerged.every((hotspot) => hotspot.requiredCapability === "swim"), true);
  });

  it("filters search by the current physical vertical interaction band", () => {
    const groundPlacement = {
      version: "wildz.encounter-placement.v1" as const,
      identity: "wildz.layer.v1:1:2:0:0000000000000001",
      x: 10,
      z: 10,
      layer: "ground" as const,
      worldY: 0,
      interactionBand: { minY: -.85, maxY: .85 },
      requiredCapability: null
    };
    const ground: HiddenHotspot = {
      id: "hotspot:1:2:0:ground",
      familyId: "mintcub",
      formId: "mintcub-1",
      regionX: 1,
      regionZ: 2,
      position: { x: 10, z: 10 },
      cover: "grass",
      shoreReachable: false,
      hitRadius: 1.15,
      hintRadius: 4.5,
      placement: groundPlacement,
      ...groundPlacement
    };
    const deepPlacement = {
      version: "wildz.encounter-placement.v1" as const,
      identity: "wildz.layer.v1:1:2:1:0000000000000002",
      x: 10,
      z: 10,
      layer: "water-column" as const,
      worldY: -4,
      interactionBand: { minY: -4.85, maxY: -3.15 },
      requiredCapability: "swim" as const
    };
    const deep: HiddenHotspot = {
      ...ground,
      id: "hotspot:1:2:1:deep",
      familyId: "titanseal",
      formId: "titanseal-1",
      cover: "water",
      placement: deepPlacement,
      ...deepPlacement
    };
    const groundContext: WildsEncounterSearchContext = { layer: "ground", worldY: 0, capabilities: [] };
    const waterContext: WildsEncounterSearchContext = { layer: "water", worldY: -4, capabilities: ["swim"] };

    assert.equal(searchHiddenHotspots([deep], deep.position, [], groundContext).kind, "empty");
    assert.equal(searchHiddenHotspots([deep], deep.position, [], { layer: "water", worldY: 0, capabilities: ["swim"] }).kind, "empty");
    assert.equal(searchHiddenHotspots([ground, deep], deep.position, [], waterContext).kind, "hit");
    const waterHit = searchHiddenHotspots([ground, deep], deep.position, [], waterContext);
    assert.equal(waterHit.kind === "hit" ? waterHit.hotspot.id : null, deep.id);

    const highPlacement = {
      version: "wildz.encounter-placement.v1" as const,
      identity: "wildz.layer.v1:1:2:2:0000000000000003",
      x: 10,
      z: 10,
      layer: "air" as const,
      worldY: 8,
      interactionBand: { minY: 7.15, maxY: 8.85 },
      requiredCapability: "flight" as const
    };
    const high: HiddenHotspot = { ...ground, id: "hotspot:1:2:2:high", placement: highPlacement, ...highPlacement };
    assert.equal(searchHiddenHotspots([high], high.position, [], { layer: "air", worldY: 1, capabilities: ["flight"] }).kind, "empty");
    assert.equal(searchHiddenHotspots([high], high.position, [], { layer: "air", worldY: 8, capabilities: ["flight"] }).kind, "hit");
  });

  it("suppresses a legacy captured region slot without changing its new layered identity", () => {
    const hotspot = hotspotsForRegion(17, -19)[0]!;
    const legacyId = `hotspot:${hotspot.regionX}:${hotspot.regionZ}:0:legacy-family`;
    const result = searchHiddenHotspots([hotspot], hotspot.position, [legacyId], {
      layer: hotspot.layer === "water-column" || hotspot.layer === "seabed" ? "water" : hotspot.layer === "air" ? "air" : "ground",
      worldY: hotspot.worldY,
      capabilities: ["swim", "glide", "flight"]
    });
    assert.equal(result.kind, "captured");
  });

  it("builds layered projections only during region admission and never during repeated searches", () => {
    const regionX = 18_500_001;
    const regionZ = -18_500_001;
    const hotspotBefore = wildsHotspotProjectionDiagnostics();
    const layerBefore = wildsLayeredEncounterDiagnostics();
    const hotspots = hotspotsForRegion(regionX, regionZ);
    const layerBuilt = wildsLayeredEncounterDiagnostics();
    for (let index = 0; index < 300; index += 1) searchHiddenHotspots(hotspots, hotspots[0]!.position, [], {
      layer: "air",
      worldY: hotspots[0]!.worldY,
      capabilities: ["swim", "glide", "flight"]
    });
    assert.equal(wildsHotspotProjectionDiagnostics().regionsBuilt - hotspotBefore.regionsBuilt, 1);
    assert.equal(layerBuilt.projectionsBuilt - layerBefore.projectionsBuilt, 6);
    assert.deepEqual(wildsLayeredEncounterDiagnostics(), layerBuilt);
  });

  it("performs zero layered generation across 300 ordinary movement updates", () => {
    const before = wildsLayeredEncounterDiagnostics();
    let state = structuredClone(initialPlayState);
    for (let index = 0; index < 300; index += 1) state = applyWildsInput(state, {
      type: "move-vector",
      x: index % 2 ? -1 : 1,
      z: 0
    });
    assert.deepEqual(wildsLayeredEncounterDiagnostics(), before);
  });
});
