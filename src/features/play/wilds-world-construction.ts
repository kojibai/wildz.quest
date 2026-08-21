import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

// Disposable local blueprint geometry only. Nothing in this module publishes
// physical world state or consumes material authority.

type Point3 = Readonly<{ x: number; y: number; z: number }>;
type Box = Readonly<{ center: Point3; halfExtents: Point3 }>;

export type WildsConstructionKind = "foundation" | "room" | "roof" | "door" | "stair" | "bridge" | "storage" | "workshop" | "habitat" | "light" | "water";
type AnchorKind = "foundation" | "wall" | "roof" | "door" | "utility" | "water";

export type WildsConstructionCatalogEntry = Readonly<{
  kind: WildsConstructionKind;
  halfExtents: Point3;
  support: "terrain" | "structure" | "terrain-or-structure" | "water";
  anchors: readonly AnchorKind[];
}>;

export type WildsBlueprintAnchor = Readonly<{ id: string; kind: AnchorKind; position: Point3 }>;
export type WildsBlueprintPlacement = Readonly<{
  schema: "wildz.blueprint-placement-preview.v1";
  blueprintId: string;
  worldId: string;
  sourceRevision: number;
  sourceBlueprintDigest: string;
  placementDigest: string;
  placementId: string;
  kind: WildsConstructionKind;
  transform: Readonly<{ position: Point3; rotationQuarterTurns: 0 | 1 | 2 | 3 }>;
  geometry: Box;
  collisionSolids: readonly Readonly<{ id: string; center: Point3; halfExtents: Point3 }>[];
  interior: Box | null;
  anchors: readonly WildsBlueprintAnchor[];
  valid: boolean;
  cues: readonly string[];
  physical: false;
  canConfirm: false;
  publish: "blocked-receiz-v122";
  writes: 0;
}>;

export type WildsBlueprintPreview = Readonly<{
  schema: "wildz.blueprint-preview.v1";
  blueprintId: string;
  worldId: string;
  revision: number;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
  heightStep: number;
  pieces: readonly WildsBlueprintPlacement[];
  physical: false;
  publish: "blocked-receiz-v122";
  writes: 0;
}>;

function freeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) freeze(entry);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

const entry = (kind: WildsConstructionKind, halfExtents: Point3, support: WildsConstructionCatalogEntry["support"], anchors: readonly AnchorKind[]) =>
  freeze({ kind, halfExtents, support, anchors });

export const WILDS_CONSTRUCTION_CATALOG: readonly WildsConstructionCatalogEntry[] = freeze([
  entry("foundation", { x: 3, y: .3, z: 3 }, "terrain", ["foundation"]),
  entry("room", { x: 3, y: 1.5, z: 3 }, "structure", ["wall", "roof", "door", "utility"]),
  entry("roof", { x: 3.2, y: .25, z: 3.2 }, "structure", ["roof"]),
  entry("door", { x: .65, y: 1.2, z: .15 }, "structure", ["door"]),
  entry("stair", { x: 1.2, y: 1, z: 2 }, "terrain-or-structure", ["foundation"]),
  entry("bridge", { x: 1.5, y: .25, z: 4 }, "terrain-or-structure", ["foundation"]),
  entry("storage", { x: .8, y: .8, z: .6 }, "structure", ["utility"]),
  entry("workshop", { x: 1.4, y: 1, z: 1 }, "structure", ["utility"]),
  entry("habitat", { x: 1.5, y: 1.2, z: 1.5 }, "structure", ["utility"]),
  entry("light", { x: .2, y: .6, z: .2 }, "structure", ["utility"]),
  entry("water", { x: 2, y: .5, z: 2 }, "water", ["water"])
]);

const CATALOG = new Map(WILDS_CONSTRUCTION_CATALOG.map((value) => [value.kind, value]));
const ACCEPTED_ANCHORS = Object.freeze({
  foundation: [],
  room: ["foundation"],
  roof: ["roof"],
  door: ["door"],
  stair: ["foundation"],
  bridge: ["foundation"],
  storage: ["utility"],
  workshop: ["utility"],
  habitat: ["utility"],
  light: ["utility"],
  water: ["water"]
} satisfies Record<WildsConstructionKind, readonly AnchorKind[]>);

function quantize(value: number, unit = .25) {
  if (unit === .000001) return Math.round(value * 1_000_000) / 1_000_000;
  return Math.round(value / unit) * unit;
}

function quarter(value: number): 0 | 1 | 2 | 3 {
  if (!Number.isSafeInteger(value)) throw new Error("wilds_blueprint_rotation_invalid");
  return (((value % 4) + 4) % 4) as 0 | 1 | 2 | 3;
}

export function createWildsBlueprintPreview(blueprintId: string, worldId: string): WildsBlueprintPreview {
  if (!blueprintId || !worldId) throw new Error("wilds_blueprint_identity_invalid");
  return freeze({ schema: "wildz.blueprint-preview.v1", blueprintId, worldId, revision: 0, rotationQuarterTurns: 0, heightStep: 0, pieces: [], physical: false, publish: "blocked-receiz-v122", writes: 0 });
}

function overlaps(first: Box, second: Box) {
  const epsilon = .000001;
  return Math.abs(first.center.x - second.center.x) < first.halfExtents.x + second.halfExtents.x - epsilon
    && Math.abs(first.center.y - second.center.y) < first.halfExtents.y + second.halfExtents.y - epsilon
    && Math.abs(first.center.z - second.center.z) < first.halfExtents.z + second.halfExtents.z - epsilon;
}

function blueprintBasis(blueprint: WildsBlueprintPreview) {
  return {
    schema: blueprint.schema,
    blueprintId: blueprint.blueprintId,
    worldId: blueprint.worldId,
    revision: blueprint.revision,
    rotationQuarterTurns: blueprint.rotationQuarterTurns,
    heightStep: blueprint.heightStep,
    pieces: blueprint.pieces
  };
}

function blueprintDigest(blueprint: WildsBlueprintPreview) {
  return sha256PortableBasis(canonicalPortableCardJson(blueprintBasis(blueprint)));
}

function finitePoint(point: Point3) {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)
    && Math.abs(point.x) <= 500_000_000 && Math.abs(point.z) <= 500_000_000 && Math.abs(point.y) <= 100_000;
}

function nearestAnchor(anchors: readonly WildsBlueprintAnchor[], pointer: Point3) {
  let nearest: WildsBlueprintAnchor | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    const candidate = Math.hypot(anchor.position.x - pointer.x, anchor.position.y - pointer.y, anchor.position.z - pointer.z);
    if (candidate < distance) {
      distance = candidate;
      nearest = anchor;
    }
  }
  return nearest && distance <= 8 ? nearest : null;
}

function rotateHorizontal(point: Point3, rotation: 0 | 1 | 2 | 3) {
  if (rotation === 1) return { x: point.z, y: point.y, z: -point.x };
  if (rotation === 2) return { x: -point.x, y: point.y, z: -point.z };
  if (rotation === 3) return { x: -point.z, y: point.y, z: point.x };
  return point;
}

function placementGeometry(kind: WildsConstructionKind, placementId: string, center: Point3, halfExtents: Point3, rotation: 0 | 1 | 2 | 3) {
  const solid = (suffix: string, offset: Point3, extents: Point3, rotate = false) => {
    const rotatedOffset = rotate ? rotateHorizontal(offset, rotation) : offset;
    const rotatedExtents = rotate && rotation % 2 === 1 ? { x: extents.z, y: extents.y, z: extents.x } : extents;
    return freeze({
    id: `${placementId}:solid:${suffix}`,
    center: freeze({ x: center.x + rotatedOffset.x, y: center.y + rotatedOffset.y, z: center.z + rotatedOffset.z }),
    halfExtents: freeze(rotatedExtents)
  });
  };
  if (kind === "water") return freeze({ collisionSolids: [], interior: null });
  if (kind === "room") {
    const wallY = 0;
    return freeze({
      collisionSolids: [
        solid("left", { x: -halfExtents.x + .15, y: wallY, z: 0 }, { x: .15, y: halfExtents.y, z: halfExtents.z }, true),
        solid("right", { x: halfExtents.x - .15, y: wallY, z: 0 }, { x: .15, y: halfExtents.y, z: halfExtents.z }, true),
        solid("back", { x: 0, y: wallY, z: -halfExtents.z + .15 }, { x: halfExtents.x, y: halfExtents.y, z: .15 }, true),
        solid("front-left", { x: -1.85, y: wallY, z: halfExtents.z - .15 }, { x: 1.15, y: halfExtents.y, z: .15 }, true),
        solid("front-right", { x: 1.85, y: wallY, z: halfExtents.z - .15 }, { x: 1.15, y: halfExtents.y, z: .15 }, true),
        solid("floor", { x: 0, y: -halfExtents.y + .1, z: 0 }, { x: halfExtents.x, y: .1, z: halfExtents.z }, true)
      ],
      interior: freeze({ center, halfExtents: freeze({ x: Math.max(.1, halfExtents.x - .3), y: Math.max(.1, halfExtents.y - .15), z: Math.max(.1, halfExtents.z - .3) }) })
    });
  }
  if (kind === "door") {
    const widthAlongX = halfExtents.x >= halfExtents.z;
    return freeze({
      collisionSolids: widthAlongX ? [
        solid("left", { x: -halfExtents.x + .1, y: 0, z: 0 }, { x: .1, y: halfExtents.y, z: halfExtents.z }),
        solid("right", { x: halfExtents.x - .1, y: 0, z: 0 }, { x: .1, y: halfExtents.y, z: halfExtents.z }),
        solid("lintel", { x: 0, y: halfExtents.y - .1, z: 0 }, { x: halfExtents.x, y: .1, z: halfExtents.z })
      ] : [
        solid("left", { x: 0, y: 0, z: -halfExtents.z + .1 }, { x: halfExtents.x, y: halfExtents.y, z: .1 }),
        solid("right", { x: 0, y: 0, z: halfExtents.z - .1 }, { x: halfExtents.x, y: halfExtents.y, z: .1 }),
        solid("lintel", { x: 0, y: halfExtents.y - .1, z: 0 }, { x: halfExtents.x, y: .1, z: halfExtents.z })
      ],
      interior: freeze({ center, halfExtents: freeze(widthAlongX
        ? { x: Math.max(.1, halfExtents.x - .2), y: Math.max(.1, halfExtents.y - .2), z: halfExtents.z }
        : { x: halfExtents.x, y: Math.max(.1, halfExtents.y - .2), z: Math.max(.1, halfExtents.z - .2) }) })
    });
  }
  return freeze({ collisionSolids: [solid("body", { x: 0, y: 0, z: 0 }, halfExtents)], interior: null });
}

function placementAnchors(kind: WildsConstructionKind, placementId: string, center: Point3, halfExtents: Point3, anchorKinds: readonly AnchorKind[], rotation: 0 | 1 | 2 | 3) {
  const bottom = center.y - halfExtents.y;
  const top = center.y + halfExtents.y;
  return freeze(anchorKinds.map((anchorKind, index) => {
    let position = { x: center.x, y: top, z: center.z };
    if (kind === "room" && anchorKind === "door") {
      const front = rotateHorizontal({ x: 0, y: 0, z: halfExtents.z }, rotation);
      position = { x: center.x + front.x, y: bottom + .2, z: center.z + front.z };
    }
    if (kind === "room" && anchorKind === "utility") position = { x: center.x, y: bottom + .2, z: center.z };
    if (kind === "room" && anchorKind === "wall") {
      const side = rotateHorizontal({ x: -halfExtents.x, y: 0, z: 0 }, rotation);
      position = { x: center.x + side.x, y: bottom, z: center.z + side.z };
    }
    return freeze({ id: `${placementId}:anchor:${index}`, kind: anchorKind, position: freeze(position) });
  }));
}

export function previewWildsBlueprintPlacement(input: Readonly<{
  blueprint: WildsBlueprintPreview;
  kind: WildsConstructionKind;
  pointer: Point3;
  rotationQuarterTurns: number;
  heightStep: number;
  physical: Readonly<{
    terrainY: number;
    waterline: number | null;
    anchors: readonly WildsBlueprintAnchor[];
    solids: readonly Readonly<{ id: string; center: Point3; halfExtents: Point3 }>[];
  }>;
}>): WildsBlueprintPlacement {
  if (!finitePoint(input.pointer)) throw new Error("wilds_blueprint_pointer_invalid");
  if (!Number.isFinite(input.physical.terrainY) || (input.physical.waterline !== null && !Number.isFinite(input.physical.waterline))) throw new Error("wilds_blueprint_surface_invalid");
  if (input.physical.anchors.some((anchor) => !anchor.id || !finitePoint(anchor.position))
    || input.physical.solids.some((solid) => !solid.id || !finitePoint(solid.center) || !finitePoint(solid.halfExtents)
      || solid.halfExtents.x <= 0 || solid.halfExtents.y <= 0 || solid.halfExtents.z <= 0)) throw new Error("wilds_blueprint_physical_evidence_invalid");
  if (!Number.isSafeInteger(input.heightStep) || Math.abs(input.heightStep) > 32) throw new Error("wilds_blueprint_height_invalid");
  const catalog = CATALOG.get(input.kind);
  if (!catalog) throw new Error("wilds_blueprint_component_invalid");
  const rotationQuarterTurns = quarter(input.rotationQuarterTurns);
  const rotated = rotationQuarterTurns % 2 === 0 ? catalog.halfExtents : { x: catalog.halfExtents.z, y: catalog.halfExtents.y, z: catalog.halfExtents.x };
  const acceptedAnchors: readonly AnchorKind[] = ACCEPTED_ANCHORS[input.kind];
  const blueprintAnchors = new Map(input.blueprint.pieces.flatMap((piece) => piece.anchors.map((candidate) => [candidate.id, candidate] as const)));
  const compatibleAnchors = input.physical.anchors.filter((candidate) => acceptedAnchors.includes(candidate.kind)
    && canonicalPortableCardJson(blueprintAnchors.get(candidate.id) ?? null) === canonicalPortableCardJson(candidate));
  const anchor = nearestAnchor(compatibleAnchors, input.pointer);
  const needsStructure = catalog.support === "structure";
  const needsWater = catalog.support === "water";
  const baseY = needsWater && input.physical.waterline !== null
    ? input.physical.waterline
    : anchor && catalog.support !== "terrain"
      ? anchor.position.y
      : input.physical.terrainY;
  const position = freeze({
    x: quantize(anchor && catalog.support !== "terrain" ? anchor.position.x : input.pointer.x, .5),
    y: quantize(baseY + rotated.y + input.heightStep * .5, .000001),
    z: quantize(anchor && catalog.support !== "terrain" ? anchor.position.z : input.pointer.z, .5)
  });
  const geometry = freeze({ center: position, halfExtents: freeze({ ...rotated }) });
  const cues: string[] = [];
  if (needsStructure && !anchor) cues.push("needs-structure-anchor");
  if (needsWater && input.physical.waterline === null) cues.push("needs-water");
  if (catalog.support === "terrain" && input.heightStep !== 0) cues.push("needs-terrain-support");
  if (catalog.support === "terrain-or-structure" && input.heightStep !== 0 && !anchor) cues.push("needs-structure-anchor");
  const sourceBlueprintDigest = blueprintDigest(input.blueprint);
  const placementBasis = { schema: "wildz.blueprint-placement-preview.v1", blueprintId: input.blueprint.blueprintId, worldId: input.blueprint.worldId, sourceRevision: input.blueprint.revision, sourceBlueprintDigest, kind: input.kind, position, rotationQuarterTurns };
  const placementId = `preview:${sha256PortableBasis(canonicalPortableCardJson(placementBasis)).slice(0, 24)}`;
  const detailedGeometry = placementGeometry(input.kind, placementId, position, geometry.halfExtents, rotationQuarterTurns);
  if (detailedGeometry.collisionSolids.some((component) => input.physical.solids.some((solid) => overlaps(component, solid)))) cues.push("blocked");
  if (detailedGeometry.collisionSolids.some((component) => input.blueprint.pieces.some((piece) => piece.collisionSolids.some((solid) => overlaps(component, solid))))) cues.push("blueprint-collision");
  const anchors = placementAnchors(input.kind, placementId, position, geometry.halfExtents, catalog.anchors, rotationQuarterTurns);
  const content = {
    schema: "wildz.blueprint-placement-preview.v1",
    blueprintId: input.blueprint.blueprintId,
    worldId: input.blueprint.worldId,
    sourceRevision: input.blueprint.revision,
    sourceBlueprintDigest,
    placementId,
    kind: input.kind,
    transform: { position, rotationQuarterTurns },
    geometry,
    collisionSolids: detailedGeometry.collisionSolids,
    interior: detailedGeometry.interior,
    anchors,
    valid: cues.length === 0,
    cues,
    physical: false,
    canConfirm: false,
    publish: "blocked-receiz-v122",
    writes: 0
  } as const;
  return freeze({ ...content, placementDigest: sha256PortableBasis(canonicalPortableCardJson(content)) });
}

function canonicalPlacementContent(placement: WildsBlueprintPlacement) {
  const catalog = CATALOG.get(placement.kind);
  if (!catalog || !finitePoint(placement.transform.position) || !Number.isSafeInteger(placement.transform.rotationQuarterTurns)) return false;
  const rotation = quarter(placement.transform.rotationQuarterTurns);
  const halfExtents = rotation % 2 === 0 ? catalog.halfExtents : { x: catalog.halfExtents.z, y: catalog.halfExtents.y, z: catalog.halfExtents.x };
  const placementBasis = {
    schema: placement.schema,
    blueprintId: placement.blueprintId,
    worldId: placement.worldId,
    sourceRevision: placement.sourceRevision,
    sourceBlueprintDigest: placement.sourceBlueprintDigest,
    kind: placement.kind,
    position: placement.transform.position,
    rotationQuarterTurns: rotation
  };
  const expectedId = `preview:${sha256PortableBasis(canonicalPortableCardJson(placementBasis)).slice(0, 24)}`;
  if (placement.placementId !== expectedId) return false;
  const expectedGeometry = freeze({ center: placement.transform.position, halfExtents: freeze({ ...halfExtents }) });
  const expectedDetails = placementGeometry(placement.kind, expectedId, placement.transform.position, halfExtents, rotation);
  const expectedAnchors = placementAnchors(placement.kind, expectedId, placement.transform.position, halfExtents, catalog.anchors, rotation);
  if (canonicalPortableCardJson(placement.geometry) !== canonicalPortableCardJson(expectedGeometry)
    || canonicalPortableCardJson(placement.collisionSolids) !== canonicalPortableCardJson(expectedDetails.collisionSolids)
    || canonicalPortableCardJson(placement.interior) !== canonicalPortableCardJson(expectedDetails.interior)
    || canonicalPortableCardJson(placement.anchors) !== canonicalPortableCardJson(expectedAnchors)) return false;
  const { placementDigest, ...content } = placement;
  return placementDigest === sha256PortableBasis(canonicalPortableCardJson(content));
}

export function reduceWildsBlueprintPreview(
  state: WildsBlueprintPreview,
  action:
    | Readonly<{ kind: "rotate"; delta: number }>
    | Readonly<{ kind: "height"; delta: number }>
    | Readonly<{ kind: "place-preview"; placement: WildsBlueprintPlacement }>
    | Readonly<{ kind: "undo-preview" }>
): WildsBlueprintPreview {
  let rotationQuarterTurns = state.rotationQuarterTurns;
  let heightStep = state.heightStep;
  let pieces = state.pieces;
  if (action.kind === "rotate") rotationQuarterTurns = quarter(state.rotationQuarterTurns + action.delta);
  if (action.kind === "height") {
    if (!Number.isSafeInteger(action.delta)) throw new Error("wilds_blueprint_height_invalid");
    heightStep = Math.max(-32, Math.min(32, state.heightStep + action.delta));
  }
  if (action.kind === "place-preview") {
    if (!action.placement.valid || action.placement.physical !== false) throw new Error("wilds_blueprint_placement_invalid");
    if (state.pieces.some((piece) => piece.placementId === action.placement.placementId)) throw new Error("wilds_blueprint_placement_duplicate");
    if (action.placement.blueprintId !== state.blueprintId
      || action.placement.worldId !== state.worldId
      || action.placement.sourceRevision !== state.revision
      || action.placement.sourceBlueprintDigest !== blueprintDigest(state)) throw new Error("wilds_blueprint_binding_invalid");
    if (!canonicalPlacementContent(action.placement)) throw new Error("wilds_blueprint_placement_content_invalid");
    if (state.pieces.length >= 64) throw new Error("wilds_blueprint_piece_limit");
    pieces = freeze([...state.pieces, action.placement]);
  }
  if (action.kind === "undo-preview") pieces = freeze(state.pieces.slice(0, -1));
  return freeze({ ...state, revision: state.revision + 1, rotationQuarterTurns, heightStep, pieces });
}

export type WildsStructureTransitionPreview = Readonly<{
  schema: "wildz.structure-transition-preview.v1";
  valid: boolean;
  reason: string | null;
  projectedIntegrity: number;
  salvageCandidateCapacity: number;
  physical: false;
  publish: "blocked-receiz-v122";
  writes: 0;
}>;

export function previewWildsStructureTransition(input: Readonly<{
  structure: Readonly<{
    structureId: string;
    structureHead: string;
    ownerSubjectId: string;
    access: "public" | "invited" | "private";
    protected: boolean;
    destructiblePublicPlay: boolean;
    integrity: number;
    maxIntegrity: number;
    materialStrength: number;
  }>;
  actorSubjectId: string;
  action: "damage" | "repair" | "salvage";
  force: number;
  allocatedRepairCapacity: number;
  consensualBattle?: boolean;
}>): WildsStructureTransitionPreview {
  const result = (valid: boolean, reason: string | null, projectedIntegrity = input.structure.integrity, salvageCandidateCapacity = 0) =>
    freeze({ schema: "wildz.structure-transition-preview.v1" as const, valid, reason, projectedIntegrity, salvageCandidateCapacity, physical: false as const, publish: "blocked-receiz-v122" as const, writes: 0 as const });
  const structure = input.structure;
  if (![structure.integrity, structure.maxIntegrity, structure.materialStrength, input.force, input.allocatedRepairCapacity].every(Number.isFinite)
    || !structure.structureId || !structure.structureHead || !structure.ownerSubjectId
    || structure.integrity < 0 || structure.integrity > structure.maxIntegrity || structure.maxIntegrity <= 0 || structure.materialStrength < 0) return result(false, "structure-invalid");
  if (structure.protected && input.action !== "repair") return result(false, "structure-protected");
  const owner = input.actorSubjectId === structure.ownerSubjectId;
  const damageAllowed = owner || structure.destructiblePublicPlay || input.consensualBattle === true;
  if (input.action === "damage") {
    if (!damageAllowed) return result(false, "policy-denied");
    if (input.force <= 0) return result(false, "force-required");
    const damage = Math.max(1, Math.ceil(Math.max(0, input.force) - structure.materialStrength * .25));
    return result(true, null, Math.max(0, structure.integrity - damage));
  }
  if (!owner) return result(false, "policy-denied");
  if (input.action === "repair") {
    if (!Number.isSafeInteger(input.allocatedRepairCapacity) || input.allocatedRepairCapacity <= 0) return result(false, "repair-capacity-required");
    return result(true, null, Math.min(structure.maxIntegrity, structure.integrity + input.allocatedRepairCapacity));
  }
  if (structure.integrity !== 0) return result(false, "structure-not-ruined");
  const salvageCandidateCapacity = Math.min(structure.materialStrength, Math.floor(structure.materialStrength / 4));
  if (salvageCandidateCapacity <= 0) return result(false, "nothing-salvageable");
  return result(true, null, 0, salvageCandidateCapacity);
}
