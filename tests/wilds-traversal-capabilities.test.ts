import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { sealCollectedCard } from "../src/features/play/portable-card";
import {
  projectWildsTraversalCapabilities,
  wildsTraversalCapabilityCacheSize
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
  it("projects aquatic, climbing, and aerial anatomy deterministically", () => {
    const tide = card("ledgerfox-1", "traversal-tide");
    const stone = card("titanseal-1", "traversal-stone");
    const winged = card("voltray-1", "traversal-winged");

    assert.deepEqual(projectWildsTraversalCapabilities(tide, emptyAdventureCondition(tide.id)).capabilities, ["swim"]);
    assert.deepEqual(projectWildsTraversalCapabilities(stone, emptyAdventureCondition(stone.id)).capabilities, ["climb"]);
    assert.deepEqual(projectWildsTraversalCapabilities(winged, emptyAdventureCondition(winged.id)).capabilities, ["glide", "flight"]);
  });

  it("removes unsafe traversal for death, severe wing injury, and exhaustion", () => {
    const winged = card("voltray-1", "traversal-condition");
    const base = emptyAdventureCondition(winged.id);
    const injured = projectWildsTraversalCapabilities(winged, {
      ...base,
      injuries: [{ id: "injury:wing", kind: "wing", severity: 2, sourceEventId: "event:fall" }]
    });
    const exhausted = projectWildsTraversalCapabilities(winged, { ...base, fatigue: 90 });
    const dead = projectWildsTraversalCapabilities(winged, { ...base, life: "dead" });

    assert.deepEqual(injured.capabilities, []);
    assert.deepEqual(exhausted.capabilities, ["glide"]);
    assert.deepEqual(dead.capabilities, []);
  });

  it("reuses a bounded projection for identical admitted state", () => {
    const tide = card("ledgerfox-1", "traversal-cache");
    const condition = emptyAdventureCondition(tide.id);
    const first = projectWildsTraversalCapabilities(tide, condition);
    const second = projectWildsTraversalCapabilities(tide, condition);

    assert.equal(first, second);
    assert.ok(wildsTraversalCapabilityCacheSize() <= 128);
  });

  it("contains no proof verification in the gameplay projector", async () => {
    const source = await readFile("src/features/play/wilds-traversal-capabilities.ts", "utf8");
    assert.doesNotMatch(source, /verifyAnyWildsCard|verifyPortableCard|verifyLiving/);
  });
});
