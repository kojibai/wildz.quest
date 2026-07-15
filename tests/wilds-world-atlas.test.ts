import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WILDS_FLAGSHIP_LANDMARKS, landmarkAtPosition, landmarkApproachPoint, projectVisibleLandmarkEntrances } from "../src/features/play/wilds-landmarks";
import { projectWildsAtlas } from "../src/features/play/wilds-world-atlas";
import type { WildsPresence } from "../src/features/play/multiplayer-core";

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
  it("keeps three flagship landmarks at stable unique coordinates", () => {
    assert.deepEqual(WILDS_FLAGSHIP_LANDMARKS.map((landmark: { id: string }) => landmark.id), [
      "hearttree-sanctum",
      "arena-of-echoes",
      "prism-arcade"
    ]);
    assert.equal(new Set(WILDS_FLAGSHIP_LANDMARKS.map((landmark: { position: { x: number; z: number } }) => `${landmark.position.x}:${landmark.position.z}`)).size, 3);
    assert.equal(landmarkAtPosition({ x: 0, z: 0 })?.id, "hearttree-sanctum");
    assert.equal(landmarkAtPosition({ x: 144, z: -96 })?.id, "arena-of-echoes");
    assert.equal(landmarkAtPosition({ x: -144, z: 96 })?.id, "prism-arcade");
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
      now: Date.parse("2026-07-15T12:00:00.000Z")
    };
    const world = projectWildsAtlas({ ...input, zoom: "world" });
    const region = projectWildsAtlas({ ...input, zoom: "region" });
    const landmark = projectWildsAtlas({ ...input, zoom: "landmark" });

    assert.deepEqual(world, projectWildsAtlas({ ...input, zoom: "world" }));
    assert.deepEqual(world.centerRegion, { x: 0, z: 0 });
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
      now: Date.parse("2026-07-15T12:00:00.000Z")
    });

    assert.equal(atlas.exactPlayers.length, 24);
    assert.deepEqual(atlas.exactPlayers.slice(0, 2).map((player: { handle: string }) => player.handle), ["Scout 1", "Scout 2"]);
    assert.equal(atlas.playerClusters.length, 0);
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
      now: Date.parse("2026-07-15T12:00:00.000Z")
    });

    assert.equal(atlas.exactPlayers.length, 0);
    assert.equal(atlas.playerClusters.length, 0);
  });
});
