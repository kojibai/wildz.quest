import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsBuildMode } from "../src/features/play/WildsBuildMode";
import {
  createWildsBlueprintPreview,
  previewWildsBlueprintPlacement,
  previewWildsStructureTransition,
  reduceWildsBlueprintPreview,
  WILDS_CONSTRUCTION_CATALOG
} from "../src/features/play/wilds-world-construction";

describe("nonphysical Wilds blueprint mode", () => {
  it("offers the bounded inhabitable component catalog without publishing authority", () => {
    assert.deepEqual(WILDS_CONSTRUCTION_CATALOG.map((entry) => entry.kind), [
      "foundation", "room", "roof", "door", "stair", "bridge", "storage", "workshop", "habitat", "light", "water"
    ]);
    assert.equal(WILDS_CONSTRUCTION_CATALOG.every((entry) => Object.isFrozen(entry)), true);
    const blueprint = createWildsBlueprintPreview("blueprint:test", "wildz.excavation.region.v1:0:0");
    assert.equal(blueprint.physical, false);
    assert.equal(blueprint.publish, "blocked-receiz-v122");
    assert.equal(blueprint.pieces.length, 0);
  });

  it("snaps exact geometry to terrain and anchors while sharing validity with collision preview", () => {
    const blueprint = createWildsBlueprintPreview("blueprint:test", "wildz.excavation.region.v1:0:0");
    const foundation = previewWildsBlueprintPlacement({
      blueprint,
      kind: "foundation",
      pointer: { x: 2.13, y: 9, z: -3.88 },
      rotationQuarterTurns: 0,
      heightStep: 0,
      physical: { terrainY: 1.25, waterline: null, anchors: [], solids: [] }
    });
    assert.equal(foundation.valid, true);
    assert.deepEqual(foundation.transform.position, { x: 2, y: 1.55, z: -4 });
    assert.equal(foundation.physical, false);
    assert.equal(foundation.canConfirm, false);
    const withFoundation = reduceWildsBlueprintPreview(blueprint, { kind: "place-preview", placement: foundation });
    const room = previewWildsBlueprintPlacement({
      blueprint: withFoundation,
      kind: "room",
      pointer: { x: 2.2, y: 1.8, z: -4.1 },
      rotationQuarterTurns: 1,
      heightStep: 0,
      physical: { terrainY: 1.25, waterline: null, anchors: foundation.anchors, solids: [] }
    });
    assert.equal(room.valid, true);
    assert.equal(room.transform.position.y > foundation.transform.position.y, true);
    assert.equal(room.geometry.halfExtents.x, 3);
    assert.equal(room.geometry.halfExtents.z, 3);
    assert.equal(room.collisionSolids.length >= 5, true);
    assert.equal(room.interior?.halfExtents.x, 2.7);
    assert.equal(room.collisionSolids.some((solid) => Math.abs(solid.center.z - room.transform.position.z) < .7 && solid.center.x > room.transform.position.x), false);
    const withRoom = reduceWildsBlueprintPreview(withFoundation, { kind: "place-preview", placement: room });
    const doorAnchor = room.anchors.find((anchor) => anchor.kind === "door")!;
    assert.equal(doorAnchor.position.x, room.transform.position.x + room.geometry.halfExtents.x);
    assert.equal(doorAnchor.position.z, room.transform.position.z);
    const door = previewWildsBlueprintPlacement({
      blueprint: withRoom,
      kind: "door",
      pointer: doorAnchor.position,
      rotationQuarterTurns: 1,
      heightStep: 0,
      physical: { terrainY: 1.25, waterline: null, anchors: room.anchors, solids: [] }
    });
    assert.equal(door.valid, true);
    assert.equal(door.interior !== null, true);
  });

  it("rejects collision, missing support, invalid water placement, and nonfinite input with exact cues", () => {
    const blueprint = createWildsBlueprintPreview("blueprint:test", "wildz.excavation.region.v1:0:0");
    const base = {
      blueprint,
      pointer: { x: 0, y: 0, z: 0 },
      rotationQuarterTurns: 0,
      heightStep: 0
    } as const;
    const colliding = previewWildsBlueprintPlacement({
      ...base,
      kind: "foundation",
      physical: { terrainY: 0, waterline: null, anchors: [], solids: [{ id: "tree:1", center: { x: 0, y: 1, z: 0 }, halfExtents: { x: 1, y: 2, z: 1 } }] }
    });
    assert.equal(colliding.valid, false);
    assert.equal(colliding.cues.includes("blocked"), true);
    const unsupported = previewWildsBlueprintPlacement({ ...base, kind: "roof", physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } });
    assert.equal(unsupported.valid, false);
    assert.equal(unsupported.cues.includes("needs-structure-anchor"), true);
    const dryWater = previewWildsBlueprintPlacement({ ...base, kind: "water", physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } });
    assert.equal(dryWater.valid, false);
    assert.equal(dryWater.cues.includes("needs-water"), true);
    const raisedFoundation = previewWildsBlueprintPlacement({ ...base, kind: "foundation", heightStep: 2, physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } });
    assert.equal(raisedFoundation.valid, false);
    assert.equal(raisedFoundation.cues.includes("needs-terrain-support"), true);
    const wrongAnchor = previewWildsBlueprintPlacement({
      ...base,
      kind: "roof",
      physical: { terrainY: 0, waterline: null, anchors: [{ id: "water:anchor", kind: "water", position: { x: 0, y: 2, z: 0 } }], solids: [] }
    });
    assert.equal(wrongAnchor.valid, false);
    assert.equal(wrongAnchor.cues.includes("needs-structure-anchor"), true);
    assert.throws(() => previewWildsBlueprintPlacement({ ...base, kind: "foundation", physical: { terrainY: 0, waterline: null, anchors: [], solids: [{ id: "bad", center: { x: 0, y: Number.NaN, z: 0 }, halfExtents: { x: 1, y: 1, z: 1 } }] } }), /physical_evidence_invalid/);
    assert.throws(() => previewWildsBlueprintPlacement({ ...base, pointer: { x: 500_000_001, y: 0, z: 0 }, kind: "foundation", physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } }), /pointer_invalid/);
    assert.throws(() => previewWildsBlueprintPlacement({ ...base, pointer: { x: Number.NaN, y: 0, z: 0 }, kind: "foundation", physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } }), /pointer_invalid/);
  });

  it("checks exact structural solids while preserving inhabitable room air", () => {
    const initial = createWildsBlueprintPreview("blueprint:room-air", "wildz.excavation.region.v1:0:0");
    const foundation = previewWildsBlueprintPlacement({
      blueprint: initial, kind: "foundation", pointer: { x: 0, y: 0, z: 0 }, rotationQuarterTurns: 0, heightStep: 0,
      physical: { terrainY: 0, waterline: null, anchors: [], solids: [] }
    });
    const grounded = reduceWildsBlueprintPreview(initial, { kind: "place-preview", placement: foundation });
    const room = previewWildsBlueprintPlacement({
      blueprint: grounded, kind: "room", pointer: { x: 0, y: 1, z: 0 }, rotationQuarterTurns: 0, heightStep: 0,
      physical: {
        terrainY: 0, waterline: null, anchors: foundation.anchors,
        solids: [{ id: "furnishing:inside", center: { x: 0, y: 1.5, z: 0 }, halfExtents: { x: .1, y: .1, z: .1 } }]
      }
    });
    assert.equal(room.valid, true);
    const wallBlocked = previewWildsBlueprintPlacement({
      blueprint: grounded, kind: "room", pointer: { x: 0, y: 1, z: 0 }, rotationQuarterTurns: 0, heightStep: 0,
      physical: {
        terrainY: 0, waterline: null, anchors: foundation.anchors,
        solids: [{ id: "tree:wall", center: { x: 2.85, y: 1.5, z: 0 }, halfExtents: { x: .1, y: .1, z: .1 } }]
      }
    });
    assert.equal(wallBlocked.cues.includes("blocked"), true);
  });

  it("binds each placement to the exact blueprint, world, and source revision", () => {
    const first = createWildsBlueprintPreview("blueprint:first", "wildz.excavation.region.v1:0:0");
    const second = createWildsBlueprintPreview("blueprint:second", "wildz.excavation.region.v1:1:0");
    const placement = previewWildsBlueprintPlacement({
      blueprint: first, kind: "foundation", pointer: { x: 0, y: 0, z: 0 }, rotationQuarterTurns: 0, heightStep: 0,
      physical: { terrainY: 0, waterline: null, anchors: [], solids: [] }
    });
    assert.throws(() => reduceWildsBlueprintPreview(second, { kind: "place-preview", placement }), /blueprint_binding_invalid/);
    const rotated = reduceWildsBlueprintPreview(first, { kind: "rotate", delta: 1 });
    assert.throws(() => reduceWildsBlueprintPreview(rotated, { kind: "place-preview", placement }), /blueprint_binding_invalid/);
    const tampered = { ...placement, transform: { ...placement.transform, position: { x: 100, y: 100, z: 100 } }, geometry: { ...placement.geometry, center: { x: 100, y: 100, z: 100 } }, collisionSolids: [], anchors: [] };
    assert.throws(() => reduceWildsBlueprintPreview(first, { kind: "place-preview", placement: tampered }), /placement_content_invalid/);
  });

  it("accepts only exact hosted anchors and keeps utility pieces above room floors", () => {
    const empty = createWildsBlueprintPreview("blueprint:hosts", "wildz.excavation.region.v1:0:0");
    const floating = previewWildsBlueprintPlacement({
      blueprint: empty, kind: "roof", pointer: { x: 0, y: 10, z: 0 }, rotationQuarterTurns: 0, heightStep: 0,
      physical: { terrainY: 0, waterline: null, anchors: [{ id: "fabricated", kind: "roof", position: { x: 0, y: 10, z: 0 } }], solids: [] }
    });
    assert.equal(floating.valid, false);
    assert.equal(floating.cues.includes("needs-structure-anchor"), true);

    const foundation = previewWildsBlueprintPlacement({ blueprint: empty, kind: "foundation", pointer: { x: 0, y: 0, z: 0 }, rotationQuarterTurns: 0, heightStep: 0, physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } });
    const grounded = reduceWildsBlueprintPreview(empty, { kind: "place-preview", placement: foundation });
    const room = previewWildsBlueprintPlacement({ blueprint: grounded, kind: "room", pointer: { x: 0, y: 0, z: 0 }, rotationQuarterTurns: 0, heightStep: 0, physical: { terrainY: 0, waterline: null, anchors: foundation.anchors, solids: [] } });
    const housed = reduceWildsBlueprintPreview(grounded, { kind: "place-preview", placement: room });
    const storage = previewWildsBlueprintPlacement({ blueprint: housed, kind: "storage", pointer: room.anchors.find((anchor) => anchor.kind === "utility")!.position, rotationQuarterTurns: 0, heightStep: 0, physical: { terrainY: 0, waterline: null, anchors: room.anchors, solids: [] } });
    assert.equal(storage.valid, true);
  });

  it("rotates, adjusts height, places, and undoes only the local preview", () => {
    const initial = createWildsBlueprintPreview("blueprint:test", "wildz.excavation.region.v1:0:0");
    const rotated = reduceWildsBlueprintPreview(initial, { kind: "rotate", delta: 1 });
    const raised = reduceWildsBlueprintPreview(rotated, { kind: "height", delta: 2 });
    assert.equal(raised.rotationQuarterTurns, 1);
    assert.equal(raised.heightStep, 2);
    const grounded = reduceWildsBlueprintPreview(raised, { kind: "height", delta: -2 });
    const placement = previewWildsBlueprintPlacement({
      blueprint: grounded,
      kind: "foundation",
      pointer: { x: 0, y: 0, z: 0 },
      rotationQuarterTurns: grounded.rotationQuarterTurns,
      heightStep: grounded.heightStep,
      physical: { terrainY: 0, waterline: null, anchors: [], solids: [] }
    });
    const placed = reduceWildsBlueprintPreview(grounded, { kind: "place-preview", placement });
    const undone = reduceWildsBlueprintPreview(placed, { kind: "undo-preview" });
    assert.equal(placed.pieces.length, 1);
    assert.equal(undone.pieces.length, 0);
    assert.equal(placed.physical, false);
    assert.equal(placed.writes, 0);
    assert.throws(() => reduceWildsBlueprintPreview(placed, { kind: "place-preview", placement }), /placement_duplicate/);
    let bounded = initial;
    for (let index = 0; index < 64; index += 1) {
      const next = previewWildsBlueprintPlacement({
        blueprint: bounded, kind: "foundation", pointer: { x: index * 10, y: 0, z: 0 }, rotationQuarterTurns: 0, heightStep: 0,
        physical: { terrainY: 0, waterline: null, anchors: [], solids: [] }
      });
      bounded = reduceWildsBlueprintPreview(bounded, { kind: "place-preview", placement: next });
    }
    const overflow = previewWildsBlueprintPlacement({
      blueprint: bounded, kind: "foundation", pointer: { x: 650, y: 0, z: 0 }, rotationQuarterTurns: 0, heightStep: 0,
      physical: { terrainY: 0, waterline: null, anchors: [], solids: [] }
    });
    assert.throws(() => reduceWildsBlueprintPreview(bounded, { kind: "place-preview", placement: overflow }), /piece_limit/);
  });

  it("renders touch-sized diegetic shape controls and exact validity without tutorial copy or a publish action", () => {
    const blueprint = createWildsBlueprintPreview("blueprint:test", "wildz.excavation.region.v1:0:0");
    const placement = previewWildsBlueprintPlacement({
      blueprint,
      kind: "foundation",
      pointer: { x: 0, y: 0, z: 0 },
      rotationQuarterTurns: 0,
      heightStep: 0,
      physical: { terrainY: 0, waterline: null, anchors: [], solids: [] }
    });
    const markup = renderToStaticMarkup(createElement(WildsBuildMode, {
      blueprint,
      selectedKind: "foundation",
      placement,
      onSelect: () => undefined,
      onRotate: () => undefined,
      onHeight: () => undefined,
      onUndo: () => undefined
    }));
    assert.equal((markup.match(/data-build-kind=/g) ?? []).length, WILDS_CONSTRUCTION_CATALOG.length);
    assert.match(markup, /aria-label="Rotate shape"/);
    assert.match(markup, /aria-label="Raise shape"/);
    assert.match(markup, /aria-label="Lower shape"/);
    assert.match(markup, /aria-label="Undo last shape"/);
    assert.match(markup, /This shape fits here/);
    assert.match(markup, /role="listitem"><button/);
    assert.doesNotMatch(markup, /<button[^>]+role="listitem"/);
    assert.doesNotMatch(markup, /step \d|tutorial|receiz|v122|publish|confirm/i);
  });
});

describe("policy-bound structure transition previews", () => {
  const structure = {
    structureId: "structure:one",
    structureHead: "head:structure:one",
    ownerSubjectId: "explorer:owner",
    access: "private" as const,
    protected: false,
    destructiblePublicPlay: false,
    integrity: 80,
    maxIntegrity: 100,
    materialStrength: 60
  };

  it("previews owner damage, repair, and bounded salvage without changing structure or inventory", () => {
    const damage = previewWildsStructureTransition({ structure, actorSubjectId: "explorer:owner", action: "damage", force: 25, allocatedRepairCapacity: 0 });
    const repair = previewWildsStructureTransition({ structure, actorSubjectId: "explorer:owner", action: "repair", force: 0, allocatedRepairCapacity: 12 });
    const salvage = previewWildsStructureTransition({ ...({ structure, actorSubjectId: "explorer:owner", action: "salvage", force: 0, allocatedRepairCapacity: 0 } as const), structure: { ...structure, integrity: 0 } });
    assert.equal(damage.valid, true);
    assert.equal(damage.projectedIntegrity < structure.integrity, true);
    assert.equal(repair.projectedIntegrity, 92);
    assert.equal(salvage.salvageCandidateCapacity > 0, true);
    for (const preview of [damage, repair, salvage]) {
      assert.equal(preview.physical, false);
      assert.equal(preview.publish, "blocked-receiz-v122");
      assert.equal(preview.writes, 0);
    }
    assert.equal(structure.integrity, 80);
  });

  it("rejects griefing, protected damage, and salvage before a structure is ruined", () => {
    assert.equal(previewWildsStructureTransition({ structure, actorSubjectId: "explorer:other", action: "damage", force: 100, allocatedRepairCapacity: 0 }).reason, "policy-denied");
    assert.equal(previewWildsStructureTransition({ structure: { ...structure, protected: true }, actorSubjectId: "explorer:owner", action: "damage", force: 100, allocatedRepairCapacity: 0 }).reason, "structure-protected");
    assert.equal(previewWildsStructureTransition({ structure, actorSubjectId: "explorer:owner", action: "salvage", force: 0, allocatedRepairCapacity: 0 }).reason, "structure-not-ruined");
    assert.equal(previewWildsStructureTransition({ structure, actorSubjectId: "explorer:owner", action: "damage", force: 0, allocatedRepairCapacity: 0 }).reason, "force-required");
    assert.equal(previewWildsStructureTransition({ structure: { ...structure, materialStrength: -1 }, actorSubjectId: "explorer:owner", action: "damage", force: 10, allocatedRepairCapacity: 0 }).reason, "structure-invalid");
    const emptyRuin = previewWildsStructureTransition({ structure: { ...structure, integrity: 0, materialStrength: 0 }, actorSubjectId: "explorer:owner", action: "salvage", force: 0, allocatedRepairCapacity: 0 });
    assert.equal(emptyRuin.valid, false);
    assert.equal(emptyRuin.reason, "nothing-salvageable");
    assert.equal(emptyRuin.salvageCandidateCapacity, 0);
  });
});
