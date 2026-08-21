import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { sealCollectedCard } from "../src/features/play/portable-card";
import {
  projectWildsTraversalCapabilities,
  wildsTraversalCapabilityCacheSize,
  wildsTraversalProjectionDiagnostics
} from "../src/features/play/wilds-traversal-capabilities";

function card(formId: string, encounterId: string) {
  return sealCollectedCard({
    formId,
    ownerReceizId: "wilds.traversal.player",
    encounterId,
    capturedAt: "2026-08-21T12:00:00.000Z"
  });
}

describe("Wildz admitted-card traversal capability projection", () => {
  it("grants only canonical defining movement at Level 1", () => {
    const aquatic = card("amberbeak-1", "traversal-level-one-aquatic");
    const powered = card("voltray-1", "traversal-level-one-powered");
    const grounded = card("mintcub-1", "traversal-level-one-grounded");

    assert.deepEqual(projectWildsTraversalCapabilities(aquatic, emptyAdventureCondition(aquatic.id)).capabilities, ["swim"]);
    assert.deepEqual(projectWildsTraversalCapabilities(powered, emptyAdventureCondition(powered.id)).capabilities, ["glide", "flight"]);
    assert.deepEqual(projectWildsTraversalCapabilities(grounded, emptyAdventureCondition(grounded.id)).capabilities, []);
  });

  it("projects aquatic, climbing, and aerial anatomy deterministically", () => {
    const tide = card("amberbeak-1", "traversal-tide");
    const stone = card("titanseal-1", "traversal-stone");
    const winged = card("voltray-1", "traversal-winged");

    assert.deepEqual(projectWildsTraversalCapabilities(tide, { ...emptyAdventureCondition(tide.id), xp: { swim: 100 } }).capabilities, ["swim"]);
    assert.deepEqual(projectWildsTraversalCapabilities(stone, { ...emptyAdventureCondition(stone.id), xp: { climb: 100 } }).capabilities, ["swim"]);
    assert.deepEqual(projectWildsTraversalCapabilities(winged, { ...emptyAdventureCondition(winged.id), xp: { flight: 400 } }).capabilities, ["glide", "flight"]);
  });

  it("removes unsafe traversal for death, severe wing injury, and exhaustion", () => {
    const winged = card("voltray-1", "traversal-condition");
    const aquatic = card("amberbeak-1", "traversal-aquatic-condition");
    const base = emptyAdventureCondition(winged.id);
    const injured = projectWildsTraversalCapabilities(winged, {
      ...base,
      injuries: [{ id: "injury:wing", kind: "wing", severity: 2, sourceEventId: "event:fall" }]
    });
    const exhausted = projectWildsTraversalCapabilities(winged, { ...base, fatigue: 90 });
    const dead = projectWildsTraversalCapabilities(winged, { ...base, life: "dead" });
    const exhaustedAquatic = projectWildsTraversalCapabilities(aquatic, {
      ...emptyAdventureCondition(aquatic.id),
      fatigue: 100
    });

    assert.deepEqual(injured.capabilities, []);
    assert.deepEqual(exhausted.capabilities, ["glide"]);
    assert.deepEqual(dead.capabilities, []);
    assert.deepEqual(exhaustedAquatic.capabilities, []);
  });

  it("reuses a bounded projection for identical admitted state", () => {
    const tide = card("amberbeak-1", "traversal-cache");
    const condition = emptyAdventureCondition(tide.id);
    const first = projectWildsTraversalCapabilities(tide, condition);
    const second = projectWildsTraversalCapabilities(tide, condition);

    assert.equal(first, second);
    assert.ok(wildsTraversalCapabilityCacheSize() <= 128);
  });

  it("admits the known deep-current swim upgrade only through the structured registry", () => {
    const land = card("mintcub-1", "traversal-upgrade-swim");
    const levelOne = projectWildsTraversalCapabilities(land, {
      ...emptyAdventureCondition(land.id),
      upgradeIds: ["deep-current-swim"]
    });
    const projection = projectWildsTraversalCapabilities(land, {
      ...emptyAdventureCondition(land.id),
      xp: { swim: 100 },
      upgradeIds: ["deep-current-swim"]
    });
    assert.equal(levelOne.capabilities.includes("swim"), false);
    assert.equal(projection.source.aquatic, true);
    assert.equal(projection.capabilities.includes("swim"), true);
  });

  it("takes the object-identity fast path before rebuilding canonical cache keys", () => {
    const tide = card("amberbeak-1", "traversal-identity-fast-path");
    const condition = emptyAdventureCondition(tide.id);
    projectWildsTraversalCapabilities(tide, condition);
    const warm = wildsTraversalProjectionDiagnostics();
    for (let index = 0; index < 300; index += 1) projectWildsTraversalCapabilities(tide, condition);
    assert.deepEqual(wildsTraversalProjectionDiagnostics(), warm);
  });

  it("contains no proof verification in the gameplay projector", async () => {
    const source = await readFile("src/features/play/wilds-traversal-capabilities.ts", "utf8");
    assert.doesNotMatch(source, /verifyAnyWildsCard|verifyPortableCard|verifyLiving/);
  });
});
