import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MORTAL_ARENA_POSITION, WILDS_FLAGSHIP_LANDMARKS, landmarkAtPosition, landmarkApproachPoint, projectVisibleLandmarkEntrances } from "../src/features/play/wilds-landmarks";
import { filterWildsAtlasPresence, projectWildsAtlas, projectWildsAtlasPresence, WILDS_ATLAS_REGION_UNIT } from "../src/features/play/wilds-world-atlas";
import { atlasLocalCoordinate } from "../src/features/play/wilds-atlas-render-tiles";
import type { WildsPresence } from "../src/features/play/multiplayer-core";
import { createInitialWildsExplorationAtlas, revealWildsExplorationAt } from "../src/features/play/wilds-exploration-atlas";
import { createWildsConstructionSite } from "../src/features/play/wilds-construction-site";
import type { WildsStructureV1 } from "../src/features/play/wilds-steward-construction";

type ProjectedWorldAddition = {
  id: string;
  phase: "construction" | "complete";
  blueprint: string;
  ownerReceizId: string;
};

function projectedWorldAdditions(value: ReturnType<typeof projectWildsAtlas>) {
  return ((value as unknown as { worldAdditions?: ProjectedWorldAddition[] }).worldAdditions ?? []);
}

function presence(index: number, position: { x: number; z: number }): WildsPresence {
  return {
    playerId: `player-${index}`,
    handle: `Scout ${index}`,
    style: index % 2 ? "female" : "male",
    x: position.x,
    z: position.z,
    heading: 0,
    status: "available",
    lastSeenAt: "2026-07-15T12:00:00.000Z",
    practice: false,
    activeCard: {
      assetId: `asset-${index}`,
      proofDigest: `sha256:${index.toString(16).padStart(64, "0")}`,
      name: `Card ${index}`,
      stats: { health: 40, power: 24, guard: 18, speed: 22, bond: 12 },
      abilities: [{ name: "Pulse", power: 7 }, { name: "Ward", power: 5 }]
    }
  };
}

describe("Wilds world atlas", () => {
  const explorationAtlas = createInitialWildsExplorationAtlas();

  it("keeps every flagship landmark at stable unique coordinates", () => {
    assert.deepEqual(WILDS_FLAGSHIP_LANDMARKS.map((landmark: { id: string }) => landmark.id), [
      "hearttree-sanctum",
      "arena-of-echoes",
      "prism-arcade",
      "wayfinder-hollow"
    ]);
    assert.equal(new Set(WILDS_FLAGSHIP_LANDMARKS.map((landmark: { position: { x: number; z: number } }) => `${landmark.position.x}:${landmark.position.z}`)).size, 4);
    assert.deepEqual(MORTAL_ARENA_POSITION, { x: 0, z: 0 });
    assert.equal(landmarkAtPosition({ x: 0, z: 0 })?.id, "arena-of-echoes");
    assert.equal(landmarkAtPosition({ x: 96, z: 144 })?.id, "hearttree-sanctum");
    assert.equal(landmarkAtPosition({ x: -144, z: 96 })?.id, "prism-arcade");
    assert.equal(landmarkAtPosition({ x: 72, z: 40 })?.id, "wayfinder-hollow");
  });

  it("projects every flagship building directly ahead of its Rift approach", () => {
    for (const landmark of WILDS_FLAGSHIP_LANDMARKS) {
      const approach = landmarkApproachPoint(landmark);
      const visible = projectVisibleLandmarkEntrances(approach);
      const entrance = visible.find((item) => item.landmark.id === landmark.id);
      assert.ok(entrance, `${landmark.name} should render from its approach`);
      assert.ok(entrance.relative.x < 0);
      assert.ok(entrance.relative.z < 0);
      assert.ok(Math.abs(entrance.relative.x - entrance.relative.z) < 0.001);
      assert.ok(entrance.distance <= 16);
    }
  });

  it("projects stable bounded detail for every atlas zoom", () => {
    const input = {
      center: { x: 0, z: 0 },
      missionProgress: 38,
      worldMastery: 11,
      discoveredLandmarkIds: ["hearttree-sanctum"],
      selfId: "self",
      players: [] as WildsPresence[],
      explorationAtlas,
      now: Date.parse("2026-07-15T12:00:00.000Z")
    };
    const world = projectWildsAtlas({ ...input, zoom: "world" });
    const region = projectWildsAtlas({ ...input, zoom: "region" });
    const landmark = projectWildsAtlas({ ...input, zoom: "landmark" });

    assert.deepEqual(world, projectWildsAtlas({ ...input, zoom: "world" }));
    assert.deepEqual(world.centerRegion, { x: 0.5, z: 0.5 });
    assert.deepEqual(world.bounds, { minX: -4, maxX: 4, minZ: -4, maxZ: 4, count: 81 });
    assert.equal(world.nodes.length, 81);
    assert.equal(region.nodes.length, 25);
    assert.equal(landmark.nodes.length, 9);
    assert.equal(world.landmarks.find((item: { id: string }) => item.id === "hearttree-sanctum")?.discovered, true);
    assert.equal(world.landmarks.find((item: { id: string }) => item.id === "arena-of-echoes")?.discovered, false);
  });

  it("shows every public explorer at their exact live world coordinate", () => {
    const players = [
      presence(1, { x: 3, z: 4 }),
      ...Array.from({ length: 30 }, (_, index) => presence(index + 2, { x: 31 + index / 10, z: 29 }))
    ];
    const atlas = projectWildsAtlas({
      center: { x: 0, z: 0 },
      zoom: "world",
      missionProgress: 30,
      worldMastery: 8,
      discoveredLandmarkIds: ["hearttree-sanctum"],
      selfId: "self",
      players,
      explorationAtlas,
      now: Date.parse("2026-07-15T12:00:00.000Z")
    });

    assert.equal(atlas.exactPlayers.length, 24);
    assert.deepEqual(atlas.exactPlayers.slice(0, 2).map((player: { handle: string }) => player.handle), ["Scout 1", "Scout 2"]);
    assert.equal(atlas.playerClusters.length, 0);
  });

  it("projects live presence without rebuilding static atlas terrain", () => {
    const players = [presence(1, { x: 3, z: 4 }), presence(2, { x: 30, z: 29 })];
    const input = {
      center: { x: 0, z: 0 },
      selfId: "self",
      players,
      explorationAtlas,
      now: Date.parse("2026-07-15T12:00:00.000Z")
    };
    const presenceOnly = projectWildsAtlasPresence(input);
    const complete = projectWildsAtlas({
      ...input,
      zoom: "world",
      missionProgress: 30,
      worldMastery: 8,
      discoveredLandmarkIds: []
    });

    assert.deepEqual(presenceOnly, {
      exactPlayers: complete.exactPlayers,
      playerClusters: complete.playerClusters
    });
    assert.equal("nodes" in presenceOnly, false);
  });

  it("expires stale presence and excludes the requesting player", () => {
    const self = presence(1, { x: 2, z: 2 });
    self.playerId = "self";
    const stale = presence(2, { x: 4, z: 4 });
    stale.lastSeenAt = "2026-07-15T11:59:00.000Z";
    const atlas = projectWildsAtlas({
      center: { x: 0, z: 0 },
      zoom: "region",
      missionProgress: 0,
      worldMastery: 0,
      discoveredLandmarkIds: [],
      selfId: "self",
      players: [self, stale],
      explorationAtlas,
      now: Date.parse("2026-07-15T12:00:00.000Z")
    });

    assert.equal(atlas.exactPlayers.length, 0);
    assert.equal(atlas.playerClusters.length, 0);
  });

  it("keeps one physical atlas scale and origin when sparse discovered territory expands", () => {
    const distantAtlas = revealWildsExplorationAt(explorationAtlas, { x: 245, z: -1433 });
    const world = projectWildsAtlas({
      center: { x: 245, z: -1433 },
      zoom: "world",
      missionProgress: 38,
      worldMastery: 11,
      discoveredLandmarkIds: [],
      selfId: "self",
      players: [],
      explorationAtlas: distantAtlas
    });

    assert.deepEqual(world.bounds, { minX: -4, maxX: 6, minZ: -31, maxZ: 4, count: 90 });
    assert.deepEqual(world.centerRegion, { x: 0.5, z: 0.5 });
    assert.equal(world.nodes.some((node) => node.regionX === 5 && node.regionZ === -30), true);
    assert.equal(world.nodes.some((node) => node.regionX === 0 && node.regionZ === -15), false);
    assert.equal(world.regionUnit, WILDS_ATLAS_REGION_UNIT);

    const initial = projectWildsAtlas({
      center: { x: 0, z: 0 },
      zoom: "world",
      missionProgress: 38,
      worldMastery: 11,
      discoveredLandmarkIds: [],
      selfId: "self",
      players: [],
      explorationAtlas
    });
    const physicalPoint = { x: 96, z: 144 };
    assert.deepEqual(
      [
        atlasLocalCoordinate(physicalPoint.x, world.centerRegion.x, world.regionUnit),
        atlasLocalCoordinate(physicalPoint.z, world.centerRegion.z, world.regionUnit)
      ],
      [
        atlasLocalCoordinate(physicalPoint.x, initial.centerRegion.x, initial.regionUnit),
        atlasLocalCoordinate(physicalPoint.z, initial.centerRegion.z, initial.regionUnit)
      ]
    );
  });

  it("uses the same physical scale and render origin at every detail level", () => {
    const atlasOrigin = { x: 5.5, z: -30.5 };
    const input = {
      center: { x: 245, z: -1433 },
      missionProgress: 38,
      worldMastery: 11,
      discoveredLandmarkIds: [],
      selfId: "self",
      players: [] as WildsPresence[],
      explorationAtlas: revealWildsExplorationAt(explorationAtlas, { x: 245, z: -1433 }),
      atlasOrigin
    };
    const projections = (["world", "region", "landmark"] as const).map((zoom) => projectWildsAtlas({ ...input, zoom }));
    assert.deepEqual(projections.map((projection) => projection.centerRegion), [atlasOrigin, atlasOrigin, atlasOrigin]);
    assert.deepEqual(projections.map((projection) => projection.regionUnit), [
      WILDS_ATLAS_REGION_UNIT,
      WILDS_ATLAS_REGION_UNIT,
      WILDS_ATLAS_REGION_UNIT
    ]);
  });

  it("does not project local or global presence outside projected discovered nodes", () => {
    const hidden = presence(1, { x: 9_000, z: 9_000 });
    const world = projectWildsAtlas({
      center: { x: 0, z: 0 },
      zoom: "world",
      missionProgress: 0,
      worldMastery: 0,
      discoveredLandmarkIds: [],
      selfId: "self",
      players: [hidden],
      explorationAtlas
    });
    const presenceOnly = projectWildsAtlasPresence({
      center: { x: 0, z: 0 },
      players: [hidden],
      selfId: "self",
      explorationAtlas,
      visibleRegions: world.nodes
    });
    const fetchedPresence = filterWildsAtlasPresence({
      exactPlayers: [{ playerId: hidden.playerId, handle: hidden.handle, style: hidden.style, x: hidden.x, z: hidden.z, status: hidden.status }],
      playerClusters: [{ id: "cluster:187:187", regionX: 187, regionZ: 187, count: 8, position: { x: 9_000, z: 9_000 } }]
    }, world.nodes);

    assert.equal(world.exactPlayers.length, 0);
    assert.equal(presenceOnly.exactPlayers.length, 0);
    assert.equal(presenceOnly.playerClusters.length, 0);
    assert.deepEqual(fetchedPresence, { exactPlayers: [], playerClusters: [] });
  });

  it("projects player construction only after its exact world region has been discovered", () => {
    const site = createWildsConstructionSite({
      blueprint: "trail-shelter",
      placedByReceizId: "builder.receiz.id",
      actorPosition: { x: 10, z: 10 },
      position: { x: 12, z: 11 },
      rotationQuarterTurns: 0,
      existingStructures: [],
      existingSites: [],
      kaiUPulse: 4_200
    });
    const distantStructure = {
      schema: "wildz.structure.v1",
      structureId: "wildz:structure:trail-shelter:distant",
      blueprint: "trail-shelter",
      ownerReceizId: "other-builder.receiz.id",
      position: { x: 9_000, y: 1, z: 9_000 },
      rotationQuarterTurns: 0,
      stage: "complete"
    } as unknown as WildsStructureV1;
    const baseInput = {
      center: { x: 0, z: 0 },
      zoom: "world" as const,
      missionProgress: 20,
      worldMastery: 5,
      discoveredLandmarkIds: [],
      selfId: "self",
      players: [] as WildsPresence[],
      constructionSites: [site],
      structures: [distantStructure]
    };

    const local = projectWildsAtlas({ ...baseInput, explorationAtlas });
    assert.deepEqual(projectedWorldAdditions(local).map((addition) => ({
      id: addition.id,
      phase: addition.phase,
      blueprint: addition.blueprint,
      ownerReceizId: addition.ownerReceizId
    })), [{
      id: site.siteId,
      phase: "construction",
      blueprint: "trail-shelter",
      ownerReceizId: "builder.receiz.id"
    }]);

    const expanded = projectWildsAtlas({
      ...baseInput,
      explorationAtlas: revealWildsExplorationAt(explorationAtlas, distantStructure.position)
    });
    assert.equal(projectedWorldAdditions(expanded).length, 2);
    assert.equal(projectedWorldAdditions(expanded).some((addition) => addition.id === distantStructure.structureId && addition.phase === "complete"), true);
  });
});
