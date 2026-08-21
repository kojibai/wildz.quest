import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWildsEcologyReceipt, projectWildsEcologyHistory } from "../src/features/play/wilds-ecology-history.js";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";
import { projectWildsAtlas } from "../src/features/play/wilds-world-atlas.js";
import { createInitialWildsExplorationAtlas, revealWildsExplorationAt } from "../src/features/play/wilds-exploration-atlas.js";

const pulse = "2026-07-15T23:00:00.000Z";
const baseInput = {
  center: { x: 0, z: 0 },
  zoom: "world" as const,
  missionProgress: 0,
  worldMastery: 0,
  discoveredLandmarkIds: [],
  selfId: "self",
  players: [],
  explorationAtlas: createInitialWildsExplorationAtlas()
};

describe("Wilds ecology atlas discovery", () => {
  it("never leaks exact coordinates before physical discovery", () => {
    const service = new WildsWorldService();
    const site = Object.values(service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" }).projection.ecologySites)[0]!;
    const rumor = projectWildsAtlas({ ...baseInput, explorationAtlas: revealWildsExplorationAt(baseInput.explorationAtlas, site.position), ecologySites: [site], ecologyKnowledge: {} }).ecologySites[0]!;

    assert.equal(rumor.visibility, "rumor");
    assert.equal("position" in rumor, false);
    assert.deepEqual(rumor.region, site.region);
    assert.equal(rumor.uncertaintyRadius > site.radius, true);
  });

  it("reveals the one canonical coordinate after a valid discovery receipt", () => {
    const service = new WildsWorldService();
    const site = Object.values(service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" }).projection.ecologySites)[0]!;
    const receipt = createWildsEcologyReceipt({
      actorId: "wilds.player.receiz.id",
      siteId: site.id,
      familyId: site.familyId,
      kind: "site.discovered",
      sourceEventId: `wve:${"c".repeat(64)}`,
      occurredAt: "2026-07-15T23:01:00.000Z",
      canonicalRevision: 9,
      mastery: 2,
      cardProofDigest: null
    });
    const knowledge = projectWildsEcologyHistory([receipt]).knowledge;
    const exact = projectWildsAtlas({ ...baseInput, explorationAtlas: revealWildsExplorationAt(baseInput.explorationAtlas, site.position), ecologySites: [site], ecologyKnowledge: knowledge }).ecologySites[0]!;

    assert.equal(exact.visibility, "exact");
    assert.equal("position" in exact, true);
    if ("position" in exact) assert.deepEqual(exact.position, site.position);
  });

  it("hides expired signals and preserves aftermath provenance", () => {
    const service = new WildsWorldService();
    const site = Object.values(service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" }).projection.ecologySites)[0]!;
    const explorationAtlas = revealWildsExplorationAt(baseInput.explorationAtlas, site.position);
    const hidden = projectWildsAtlas({ ...baseInput, explorationAtlas, ecologySites: [{ ...site, phase: "expired" }], ecologyKnowledge: {} });
    const aftermath = projectWildsAtlas({ ...baseInput, explorationAtlas, ecologySites: [{ ...site, phase: "aftermath" }], ecologyKnowledge: {} }).ecologySites[0]!;

    assert.equal(hidden.ecologySites.length, 0);
    assert.equal(aftermath.visibility, "aftermath");
    assert.equal("position" in aftermath, true);
  });

  it("does not disclose ecology whose physical coordinate is outside projected discovery", () => {
    const service = new WildsWorldService();
    const site = Object.values(service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" }).projection.ecologySites)[0]!;
    const hidden = projectWildsAtlas({
      ...baseInput,
      ecologySites: [{ ...site, position: { x: 9_000, z: 9_000 } }],
      ecologyKnowledge: {}
    });
    assert.equal(hidden.ecologySites.length, 0);
  });
});
