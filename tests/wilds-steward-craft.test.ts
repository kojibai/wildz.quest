import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WILDS_STEWARD_BLUEPRINTS,
  constructionSourcesNear,
  projectWildsStewardCraft,
  projectWildsStewardPlacement
} from "../src/features/play/wilds-steward-craft";
import type { WildsMaterialLotV1 } from "../src/features/play/wilds-steward-construction";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";

function lot(kind: "hay" | "timber" | "stone", index: number): WildsMaterialLotV1 {
  return { kind, lotId: `${kind}:${index}` } as WildsMaterialLotV1;
}

describe("Steward Craft player projection", () => {
  it("keeps canonical construction discovery bounded at the world edge", () => {
    const sources = constructionSourcesNear({ x: 500_000_000, z: 500_000_000 });
    assert.equal(new Set(sources.map((source) => source.sourceId)).size, sources.length);
    assert.equal(sources.length <= 24, true);
  });

  it("reuses one bounded source projection across fractional movement in a stable cell", () => {
    const first = constructionSourcesNear({ x: 16.1, z: -7.8 });
    const second = constructionSourcesNear({ x: 16.8, z: -7.1 });
    assert.equal(second, first);
    assert.equal(first.length <= 24, true);
    assert.equal(first.every((source) => Math.hypot(source.position.x - 18, source.position.z + 6) <= 11), true);
  });

  it("includes a canonical hay patch when its stable visible neighborhood reaches it", () => {
    const hay = projectWildsResourceRegion(0, 0).find((source) => source.kind === "hay");
    assert.ok(hay);
    const visible = constructionSourcesNear(hay.position);
    assert.equal(visible.some((source) => source.sourceId === hay.sourceId), true);
  });
  it("publishes the four end-to-end admitted blueprints with exact requirements", () => {
    assert.deepEqual(WILDS_STEWARD_BLUEPRINTS.map(({ id, materials }) => ({ id, materials })), [
      { id: "trail-shelter", materials: { timber: 2, stone: 1 } },
      { id: "trail-bridge", materials: { timber: 4, stone: 2 } },
      { id: "steward-workbench", materials: { timber: 3, stone: 2 } },
      { id: "trail-cache", materials: { timber: 2, stone: 2 } }
    ]);
  });

  it("requires every exact material before any construction site can be placed", () => {
    const projection = projectWildsStewardCraft({
      activeCreatureName: "Mosslight",
      materialLots: [lot("hay", 1), lot("timber", 1), lot("timber", 2), lot("stone", 1)],
      pending: false,
      selectedBlueprintId: null,
      workMeters: [{ family: "lumber", label: "Woodland", guidance: "Tend timber", value: 72, state: "ready" }]
    });
    assert.deepEqual(projection.materials, { hay: 1, timber: 2, stone: 1 });
    assert.equal(projection.partner.name, "Mosslight");
    assert.equal(projection.partner.capacity, 72);
    assert.equal(projection.blueprints.find((item) => item.id === "trail-shelter")?.state, "ready");
    assert.equal(projection.blueprints.find((item) => item.id === "trail-bridge")?.state, "materials");
    assert.deepEqual(projection.blueprints.find((item) => item.id === "trail-bridge")?.missing, { timber: 2, stone: 1 });

    const recovering = projectWildsStewardCraft({
      activeCreatureName: "Mosslight",
      materialLots: [lot("timber", 1), lot("timber", 2), lot("stone", 1)],
      pending: false,
      selectedBlueprintId: null,
      workMeters: [{ family: "lumber", label: "Woodland", guidance: "Tend timber", value: 8, state: "recovering" }]
    });
    assert.equal(recovering.blueprints.find((item) => item.id === "trail-shelter")?.state, "ready");
    assert.equal(recovering.blueprints.find((item) => item.id === "steward-workbench")?.state, "materials");
  });

  it("previews reachable dry shelter ground without consuming any exact lot", () => {
    const lots = Object.freeze([lot("timber", 1), lot("timber", 2), lot("stone", 1)]);
    const before = lots.map((item) => item.lotId);
    const preview = projectWildsStewardPlacement({
      actorPosition: { x: 0, z: 0 },
      blueprintId: "trail-shelter",
      point: { x: 2, z: 1 }
    });
    assert.equal(preview.valid, true);
    assert.equal(preview.reason, null);
    assert.equal(preview.rotationQuarterTurns, 0);
    assert.deepEqual(lots.map((item) => item.lotId), before);
  });

  it("never presents a full or ready work meter when injuries require recovery", async () => {
    const { projectWildsWorkCapabilityMeters } = await import("../src/features/play/wilds-work-capability.js");
    const asset = { manifest: { formId: "mintcub-1" } } as never;
    const meters = projectWildsWorkCapabilityMeters(asset, { fatigue: 0, injuries: ["a", "b", "c", "d"] } as never);
    assert.equal(meters[0]?.state, "recovering");
    assert.equal((meters[0]?.value ?? 100) <= 15, true);
  });

  it("rejects unreachable placement and admits a bridge only from its physical bank reading", () => {
    assert.deepEqual(projectWildsStewardPlacement({
      actorPosition: { x: 0, z: 0 },
      blueprintId: "trail-shelter",
      point: { x: 8, z: 0 }
    }), {
      blueprintId: "trail-shelter",
      point: { x: 8, z: 0 },
      rotationQuarterTurns: 0,
      valid: false,
      reason: "Move within reach before placing."
    });

    let bridge = null;
    for (let x = -96; x <= 96 && !bridge; x += 1) for (let z = -96; z <= 96 && !bridge; z += 1) {
      const candidate = projectWildsStewardPlacement({ actorPosition: { x, z }, blueprintId: "trail-bridge", point: { x, z } });
      if (candidate.valid) bridge = candidate;
    }
    assert.ok(bridge, "expected deterministic terrain to expose at least one valid crossing");
    assert.ok(bridge.rotationQuarterTurns === 0 || bridge.rotationQuarterTurns === 1);
  });
});
