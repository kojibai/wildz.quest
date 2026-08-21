import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bossTerritoryApproachPoint } from "../src/features/play/wilds-rift-travel.js";
import { projectWildsAtlas } from "../src/features/play/wilds-world-atlas.js";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";
import { createInitialWildsExplorationAtlas, revealWildsExplorationAt } from "../src/features/play/wilds-exploration-atlas.js";

const pulse = "2026-07-15T12:00:00.000Z";
const base = { center: { x: 0, z: 0 }, zoom: "world" as const, missionProgress: 0, worldMastery: 0, discoveredLandmarkIds: [], selfId: "self", players: [], explorationAtlas: createInitialWildsExplorationAtlas() };

describe("boss atlas tracking", () => {
  it("omits exact boss coordinates until accepted tracking knowledge", () => {
    const service = new WildsWorldService();
    const boss = Object.values(service.tick({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" }).projection.bosses)[0]!;
    const position = boss.position as { x: number; z: number };
    const explorationAtlas = revealWildsExplorationAt(base.explorationAtlas, position);
    const rumor = projectWildsAtlas({ ...base, explorationAtlas, bosses: [boss], bossKnowledge: {} }).bosses[0]!;
    assert.equal("position" in rumor, false);
    const exact = projectWildsAtlas({ ...base, explorationAtlas, bosses: [boss], bossKnowledge: { [boss.id]: { bossId: boss.id, familyId: boss.familyId as "crystal-burrower", lastSeenAt: pulse, lastRevision: 4, encounters: 1 } } }).bosses[0]!;
    assert.equal("position" in exact, true);
    if ("position" in exact) assert.deepEqual(exact.position, boss.position);
  });

  it("Rifts outside boss territory and requires walking to enter", () => {
    const boss = { position: { x: 100, z: 50 }, territoryRadius: 18, seedDigest: `sha256:${"a".repeat(64)}` };
    const approach = bossTerritoryApproachPoint(boss);
    assert.equal(Math.hypot(approach.x - boss.position.x, approach.z - boss.position.z) > boss.territoryRadius, true);
  });

  it("filters bosses by their physical coordinate rather than their ecology region id", () => {
    const service = new WildsWorldService();
    const boss = Object.values(service.tick({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" }).projection.bosses)[0]!;
    const hidden = projectWildsAtlas({
      ...base,
      bosses: [{ ...boss, position: { x: 9_000, z: 9_000 } }],
      bossKnowledge: {}
    });
    assert.equal(hidden.bosses.length, 0);
  });
});
