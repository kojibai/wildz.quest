import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WILDS_STEWARD_BLUEPRINTS,
  projectWildsStewardCraft,
  projectWildsStewardPlacement
} from "../src/features/play/wilds-steward-craft";
import type { WildsMaterialLotV1 } from "../src/features/play/wilds-steward-construction";

function lot(kind: "timber" | "stone", index: number): WildsMaterialLotV1 {
  return { kind, lotId: `${kind}:${index}` } as WildsMaterialLotV1;
}

describe("Steward Craft player projection", () => {
  it("publishes the four end-to-end admitted blueprints with exact requirements", () => {
    assert.deepEqual(WILDS_STEWARD_BLUEPRINTS.map(({ id, materials }) => ({ id, materials })), [
      { id: "trail-shelter", materials: { timber: 2, stone: 1 } },
      { id: "trail-bridge", materials: { timber: 4, stone: 2 } },
      { id: "steward-workbench", materials: { timber: 3, stone: 2 } },
      { id: "trail-cache", materials: { timber: 2, stone: 2 } }
    ]);
  });

  it("binds readiness to the exact material bank and active creature condition", () => {
    const projection = projectWildsStewardCraft({
      activeCreatureName: "Mosslight",
      materialLots: [lot("timber", 1), lot("timber", 2), lot("stone", 1)],
      pending: false,
      selectedBlueprintId: null,
      workMeters: [{ family: "lumber", label: "Woodland", guidance: "Tend timber", value: 72, state: "ready" }]
    });
    assert.deepEqual(projection.materials, { timber: 2, stone: 1 });
    assert.equal(projection.partner.name, "Mosslight");
    assert.equal(projection.partner.capacity, 72);
    assert.equal(projection.blueprints.find((item) => item.id === "trail-shelter")?.state, "ready");
    assert.equal(projection.blueprints.find((item) => item.id === "trail-bridge")?.state, "materials");

    const recovering = projectWildsStewardCraft({
      activeCreatureName: "Mosslight",
      materialLots: [lot("timber", 1), lot("timber", 2), lot("stone", 1)],
      pending: false,
      selectedBlueprintId: null,
      workMeters: [{ family: "lumber", label: "Woodland", guidance: "Tend timber", value: 8, state: "recovering" }]
    });
    assert.equal(recovering.blueprints.find((item) => item.id === "trail-shelter")?.state, "partner");
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
