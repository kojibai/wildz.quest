import type {
  ReceizClient,
  ReceizWorldAuthorityV1,
  ReceizWorldCommandInputV1,
  ReceizWorldCommandPlanV1,
  ReceizWorldExecutionResultV1,
  ReceizWorldTransactionAuthorityV1,
  ReceizWorldTransactionV1
} from "@receiz/sdk";
import type {
  CreatureCapabilityIdentityV1,
  CreatureRuntimeCapabilities,
  CreatureSpecialtyFamily
} from "./creature-capability-identity";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { isCanonicalWildsDiscoverySiteKey, type WildsDiscoveryPhysicalNeighborhood } from "./wilds-discovery-sites";
import { sampleWildsTerrain } from "./wilds-terrain-authority";

export const WILDS_EXCAVATION_VERSION = "wildz.excavation.v1" as const;
export const WILDS_EXCAVATION_REGISTRY_DIGEST = sha256PortableBasis("wildz.excavation.registry.v1");
export const WILDS_EXCAVATION_REDUCER_DIGEST = sha256PortableBasis("wildz.excavation.reducer.v1");

type Point3 = Readonly<{ x: number; y: number; z: number }>;
type AccessMode = "public" | "invited" | "private";
type AccessPolicy = Readonly<{ mode: AccessMode; grantsDigest: string }>;
type PublicIdentity = Readonly<{ proofDigest: string; proofObjectId: string; publicAlias: string | null; public: boolean }>;
export type WildsExcavationPhysicalEvidence = Readonly<{
  projectionDigest: string;
  spaceId: string;
  safetyDigest: string;
  substrate: "soil" | "rock";
  surfaceExit: boolean;
  rescueRoute: boolean;
  flooded: boolean;
}>;

export type WildsExcavationCapabilityEvidence = Readonly<{
  identity: CreatureCapabilityIdentityV1;
  runtime: CreatureRuntimeCapabilities;
  conditionDigest: string;
}>;

export type WildsExcavationPreview = Readonly<{
  schema: "wildz.excavation.preview.v1";
  physical: false;
  previewDigest: string;
  worldId: string;
  siteKey: string;
  actorSubjectId: string;
  creatureSubjectId: string;
  creator: PublicIdentity;
  creature: Readonly<{ proofDigest: string; proofObjectId: string; publicName: string | null }>;
  capability: Readonly<{
    identityDigest: string;
    conditionDigest: string;
    families: readonly CreatureSpecialtyFamily[];
  }>;
  substrate: "soil" | "rock";
  geometry: Readonly<{
    from: Point3;
    to: Point3;
    radius: number;
    surfaceExit: boolean;
    rescueRoute: boolean;
    flooded: boolean;
  }>;
  safety: Readonly<{
    protectedVolumes: readonly Readonly<{ id: string; center: Point3; halfExtents: Point3 }>[];
    canonicalRoutes: readonly Readonly<{ id: string; points: readonly Point3[] }>[];
    rescueAnchor: Point3;
  }>;
  safetyDigest: string;
  physicalAuthority: WildsExcavationPhysicalEvidence;
  access: AccessPolicy;
  creationKai: string;
  priorGraphHead: string;
  idempotencyKey: string;
  candidateEventDigest: string;
}>;

export type WildsExcavationEvent = Readonly<{
  schema: "wildz.excavation.event.v1";
  eventId: string;
  commandId: string;
  worldId: string;
  priorGraphHead: string;
  graphHead: string;
  receizPriorWorldHead: string;
  receizWorldHead: string;
  idempotencyKey: string;
  candidateEventDigest: string;
  preview: WildsExcavationPreview;
  registryDigest: typeof WILDS_EXCAVATION_REGISTRY_DIGEST;
  reducerDigest: typeof WILDS_EXCAVATION_REDUCER_DIGEST;
}>;

export type WildsExcavationSegment = Readonly<{
  id: string;
  siteKey: string;
  from: Point3;
  to: Point3;
  radius: number;
  flooded: boolean;
  access: AccessPolicy;
  ownerSubjectId: string;
  creator: PublicIdentity;
  creature: WildsExcavationPreview["creature"];
  creationKai: string;
  steward: PublicIdentity;
  sourceEventId: string;
}>;

export type WildsExcavationGraph = Readonly<{
  schema: "wildz.excavation.graph.v1";
  worldId: string;
  receizWorldHead: string;
  head: string;
  events: readonly WildsExcavationEvent[];
  segments: readonly WildsExcavationSegment[];
  chambers: readonly never[];
  idempotencyKeys: readonly string[];
}>;

export type WildsExcavationReceizPort = Readonly<{
  resolveSubject(subjectId: string): Promise<Readonly<{
    subjectId: string;
    head: string;
    registryDigest: string;
    reducerDigest: string;
    proofObjectId: string;
    identityDigest: string;
    currentOwnerReceizId: string;
    capabilityIdentityDigest: string | null;
    conditionDigest: string | null;
  }>>;
  resolvePhysicalEvidence(preview: WildsExcavationPreview): Promise<WildsExcavationPhysicalEvidence>;
  planCommand: ReceizClient["world"]["planCommand"];
  validateCommand: ReceizClient["world"]["validateCommand"];
  planTransaction: ReceizClient["world"]["planTransaction"];
  executeTransaction: ReceizClient["world"]["executeTransaction"];
  additions: ReceizClient["world"]["additions"];
}>;

export type WildsExcavationPendingAdmission = Readonly<{
  schema: "wildz.excavation.pending_admission.v1";
  preview: WildsExcavationPreview;
  graphHead: string;
  commandPlans: readonly [ReceizWorldCommandPlanV1, ReceizWorldCommandPlanV1];
  transaction: ReceizWorldTransactionV1;
}>;

export type WildsExcavationAdmissionJournal = Readonly<{
  read(worldId: string, idempotencyKey: string): Promise<WildsExcavationPendingAdmission | null>;
  stage(entry: WildsExcavationPendingAdmission): Promise<void>;
  remove(worldId: string, idempotencyKey: string): Promise<void>;
}>;

type PreviewResult = Readonly<{ ok: true; preview: WildsExcavationPreview }>
  | Readonly<{ ok: false; code: string; writes: 0 }>;

type AdmissionResult = Readonly<{ ok: true; graph: WildsExcavationGraph; receiptId: string }>
  | Readonly<{ ok: false; code: string; writes: 0; graph: WildsExcavationGraph }>;

const WORLD_LIMIT = 500_000_000;
const MAX_SEGMENT_LENGTH = 48;
const PHYSICAL_CACHE_LIMIT = 48;
const physicalGraphCache = new Map<WildsExcavationGraph, WeakMap<WildsExcavationViewerAccess, Readonly<{ segments: readonly Readonly<{
  id: string;
  siteKey: string;
  from: Point3;
  to: Point3;
  radius: number;
  flooded: boolean;
  accessMode: AccessMode;
}>[]; chambers: readonly never[] }>>>();
let physicalGraphBuilds = 0;
let viewerAccessBuilds = 0;

export type WildsExcavationViewerAccess = Readonly<{
  actorSubjectId: string | null;
  grants: ReadonlyMap<string, Readonly<{ grantsDigest: string; actorSubjectId: string; admitted: boolean; revoked: boolean }>>;
}>;

const ANONYMOUS_VIEWER_ACCESS: WildsExcavationViewerAccess = immutable({
  actorSubjectId: null,
  grants: new Map()
});

export function wildsExcavationWorldIdForSite(siteKey: string) {
  if (!isCanonicalWildsDiscoverySiteKey(siteKey)) throw new Error("wilds_excavation_site_key_invalid");
  const match = siteKey.match(/^wildz\.site\.v1:(-?\d+):(-?\d+):/)!;
  return `wildz.excavation.region.v1:${match[1]}:${match[2]}`;
}

function siteRegionBounds(siteKey: string) {
  const match = siteKey.match(/^wildz\.site\.v1:(-?\d+):(-?\d+):/)!;
  const regionX = Number(match[1]);
  const regionZ = Number(match[2]);
  return { minX: regionX * 128, maxX: regionX * 128 + 128, minZ: regionZ * 128, maxZ: regionZ * 128 + 128 };
}

function distance(a: Point3, b: Point3) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function distanceToSegment(point: Point3, start: Point3, end: Point3) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const amount = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) / lengthSquared));
  return distance(point, { x: start.x + dx * amount, y: start.y + dy * amount, z: start.z + dz * amount });
}

function segmentDistance(firstStart: Point3, firstEnd: Point3, secondStart: Point3, secondEnd: Point3) {
  const ux = firstEnd.x - firstStart.x; const uy = firstEnd.y - firstStart.y; const uz = firstEnd.z - firstStart.z;
  const vx = secondEnd.x - secondStart.x; const vy = secondEnd.y - secondStart.y; const vz = secondEnd.z - secondStart.z;
  const wx = firstStart.x - secondStart.x; const wy = firstStart.y - secondStart.y; const wz = firstStart.z - secondStart.z;
  const a = ux * ux + uy * uy + uz * uz;
  const b = ux * vx + uy * vy + uz * vz;
  const c = vx * vx + vy * vy + vz * vz;
  const d = ux * wx + uy * wy + uz * wz;
  const e = vx * wx + vy * wy + vz * wz;
  const epsilon = 1e-9;
  const denominator = a * c - b * b;
  let firstNumerator: number;
  let firstDenominator = denominator;
  let secondNumerator: number;
  let secondDenominator = denominator;
  if (denominator < epsilon) {
    firstNumerator = 0;
    firstDenominator = 1;
    secondNumerator = e;
    secondDenominator = c;
  } else {
    firstNumerator = b * e - c * d;
    secondNumerator = a * e - b * d;
    if (firstNumerator < 0) {
      firstNumerator = 0;
      secondNumerator = e;
      secondDenominator = c;
    } else if (firstNumerator > firstDenominator) {
      firstNumerator = firstDenominator;
      secondNumerator = e + b;
      secondDenominator = c;
    }
  }
  if (secondNumerator < 0) {
    secondNumerator = 0;
    if (-d < 0) firstNumerator = 0;
    else if (-d > a) firstNumerator = firstDenominator;
    else { firstNumerator = -d; firstDenominator = a; }
  } else if (secondNumerator > secondDenominator) {
    secondNumerator = secondDenominator;
    if (-d + b < 0) firstNumerator = 0;
    else if (-d + b > a) firstNumerator = firstDenominator;
    else { firstNumerator = -d + b; firstDenominator = a; }
  }
  const firstAmount = Math.abs(firstNumerator) < epsilon ? 0 : firstNumerator / Math.max(firstDenominator, epsilon);
  const secondAmount = Math.abs(secondNumerator) < epsilon ? 0 : secondNumerator / Math.max(secondDenominator, epsilon);
  return Math.hypot(wx + firstAmount * ux - secondAmount * vx, wy + firstAmount * uy - secondAmount * vy, wz + firstAmount * uz - secondAmount * vz);
}

function segmentIntersectsAabb(start: Point3, end: Point3, center: Point3, halfExtents: Point3) {
  let minimum = 0;
  let maximum = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const delta = end[axis] - start[axis];
    const low = center[axis] - halfExtents[axis];
    const high = center[axis] + halfExtents[axis];
    if (Math.abs(delta) < 1e-9) {
      if (start[axis] < low || start[axis] > high) return false;
      continue;
    }
    const first = (low - start[axis]) / delta;
    const second = (high - start[axis]) / delta;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
    if (minimum > maximum) return false;
  }
  return true;
}

function immutable<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) immutable(entry);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) immutable(entry);
    return Object.freeze(value);
  }
  return value;
}

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

export function digestWildsExcavationCapabilityIdentity(identity: CreatureCapabilityIdentityV1) {
  return digest(identity);
}

export function digestWildsExcavationSafetyAuthority(safety: WildsExcavationPreview["safety"]) {
  return digest(safety);
}

export function deriveWildsExcavationPhysicalAuthority(
  physical: WildsDiscoveryPhysicalNeighborhood,
  siteKey: string,
  geometry: WildsExcavationPreview["geometry"]
) {
  const site = physical.sites.find((candidate) => candidate.key === siteKey);
  if (!site) throw new Error("wilds_excavation_site_not_in_physical_projection");
  const contains = (center: Point3, halfExtents: Point3, point: Point3) =>
    Math.abs(point.x - center.x) <= halfExtents.x
    && Math.abs(point.y - center.y) <= halfExtents.y + geometry.radius
    && Math.abs(point.z - center.z) <= halfExtents.z;
  const surface = physical.surfaces.find((candidate) => contains(candidate.center, candidate.halfExtents, geometry.from)
    && contains(candidate.center, candidate.halfExtents, geometry.to));
  const spaceId = surface?.spaceId ?? "wildz.space.outer.v1";
  const waterVolumes = physical.waterVolumes.filter((volume) => volume.spaceId === spaceId
    && segmentIntersectsAabb(geometry.from, geometry.to, volume.center, {
      x: volume.halfExtents.x + geometry.radius,
      y: volume.halfExtents.y + geometry.radius,
      z: volume.halfExtents.z + geometry.radius
    }));
  const substrate = physical.solids.some((solid) => solid.spaceId === spaceId
    && segmentIntersectsAabb(geometry.from, geometry.to, solid.center, {
      x: solid.halfExtents.x + geometry.radius,
      y: solid.halfExtents.y + geometry.radius,
      z: solid.halfExtents.z + geometry.radius
    })) ? "rock" as const : "soil" as const;
  const endpointAtOuterSurface = [geometry.from, geometry.to].some((point) =>
    Math.abs(point.y - sampleWildsTerrain(point.x, point.z).elevation) <= geometry.radius + .75);
  const portalReachable = physical.portals.some((portal) => portal.siteKey === siteKey
    && portal.toSpaceId === spaceId
    && Math.min(distance(portal.position, geometry.from), distance(portal.position, geometry.to)) <= geometry.radius * 3);
  const surfaceExit = spaceId === "wildz.space.outer.v1" ? endpointAtOuterSurface : portalReachable;
  const rescueRoute = surfaceExit || portalReachable;
  const safety = immutable({
    protectedVolumes: physical.solids.filter((solid) => solid.siteKey !== siteKey).map((solid) => immutable({
      id: solid.id,
      center: solid.center,
      halfExtents: solid.halfExtents
    })),
    canonicalRoutes: physical.sites.flatMap((candidate) => candidate.routes.filter((route) => route.safe).map((route) => immutable({
      id: route.id,
      points: route.points
    }))),
    rescueAnchor: site.entrance
  });
  const evidence: WildsExcavationPhysicalEvidence = immutable({
    projectionDigest: digest(physical),
    spaceId,
    safetyDigest: digest(safety),
    substrate,
    surfaceExit,
    rescueRoute,
    flooded: waterVolumes.length > 0
  });
  return immutable({ safety, evidence });
}

function finitePoint(point: Point3) {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)
    && Math.abs(point.x) <= WORLD_LIMIT && Math.abs(point.z) <= WORLD_LIMIT && Math.abs(point.y) <= 100_000;
}

function familyAvailable(evidence: WildsExcavationCapabilityEvidence, family: CreatureSpecialtyFamily) {
  const specialty = evidence.identity.specialties.find((entry) => entry.family === family);
  if (!specialty) return false;
  const descriptor = evidence.identity.abilities.find((entry) => entry.tags.includes(family));
  if (!descriptor) return false;
  return evidence.runtime.assetId === evidence.identity.assetId
    && evidence.runtime.abilities.some((entry) => entry.descriptor.id === descriptor.id && entry.available && entry.currentPower > 0);
}

function rejection(code: string): PreviewResult {
  return immutable({ ok: false, code, writes: 0 });
}

export function previewWildsExcavation(input: Readonly<{
  worldId: string;
  siteKey: string;
  actorSubjectId: string;
  creatureSubjectId: string;
  creator: PublicIdentity;
  creature: Readonly<{ proofDigest: string; proofObjectId: string; publicName: string | null }>;
  capability: WildsExcavationCapabilityEvidence;
  substrate: "soil" | "rock";
  geometry: WildsExcavationPreview["geometry"];
  access: Readonly<{ mode: AccessMode; invitedSubjectIds: readonly string[] }>;
  safety: Readonly<{
    protectedVolumes: readonly Readonly<{ id: string; center: Point3; halfExtents: Point3 }>[];
    canonicalRoutes: readonly Readonly<{ id: string; points: readonly Point3[] }>[];
    rescueAnchor: Point3;
  }>;
  physicalAuthority: Omit<WildsExcavationPhysicalEvidence, "safetyDigest" | "substrate" | "surfaceExit" | "rescueRoute" | "flooded">;
  creationKai: string;
  priorGraphHead: string;
  idempotencyKey?: string;
}>): PreviewResult {
  if (!input.worldId || !input.siteKey || !input.actorSubjectId || !input.creatureSubjectId) return rejection("identity_required");
  try {
    if (input.worldId !== wildsExcavationWorldIdForSite(input.siteKey)) return rejection("world_region_mismatch");
  } catch {
    return rejection("site_key_invalid");
  }
  const bounds = siteRegionBounds(input.siteKey);
  if ([input.geometry.from, input.geometry.to].some((point) => point.x < bounds.minX || point.x >= bounds.maxX || point.z < bounds.minZ || point.z >= bounds.maxZ)) return rejection("cross_region_geometry_forbidden");
  if (input.capability.identity.assetId !== input.creatureSubjectId || input.creature.proofDigest !== input.capability.identity.digestInput.proofDigest) return rejection("creature_proof_mismatch");
  if (!familyAvailable(input.capability, "burrow")) return rejection("capability_unavailable");
  if (input.substrate === "rock" && !familyAvailable(input.capability, "break")) return rejection("rock_break_capability_required");
  if (!finitePoint(input.geometry.from) || !finitePoint(input.geometry.to) || !Number.isFinite(input.geometry.radius)) return rejection("geometry_invalid");
  const dx = input.geometry.to.x - input.geometry.from.x;
  const dy = input.geometry.to.y - input.geometry.from.y;
  const dz = input.geometry.to.z - input.geometry.from.z;
  const length = Math.hypot(dx, dy, dz);
  if (length < 2 || length > MAX_SEGMENT_LENGTH || input.geometry.radius < 0.9 || input.geometry.radius > 3) return rejection("geometry_invalid");
  if (Math.abs(dy) / Math.hypot(dx, dz) > 0.75) return rejection("unsafe_grade");
  if (!finitePoint(input.safety.rescueAnchor)) return rejection("rescue_anchor_invalid");
  if (input.safety.protectedVolumes.some((volume) => segmentIntersectsAabb(input.geometry.from, input.geometry.to, volume.center, {
    x: volume.halfExtents.x + input.geometry.radius,
    y: volume.halfExtents.y + input.geometry.radius,
    z: volume.halfExtents.z + input.geometry.radius
  }))) return rejection("protected_volume_conflict");
  if (input.safety.canonicalRoutes.some((route) => route.points.some((point, index) => index === 0
    ? distanceToSegment(point, input.geometry.from, input.geometry.to) <= input.geometry.radius + 1
    : segmentDistance(route.points[index - 1]!, point, input.geometry.from, input.geometry.to) <= input.geometry.radius + 1 + 1e-7))) return rejection("canonical_route_conflict");
  const { surfaceExit, rescueRoute, flooded } = input.geometry;
  if (rescueRoute && Math.min(distance(input.safety.rescueAnchor, input.geometry.from), distance(input.safety.rescueAnchor, input.geometry.to)) > input.geometry.radius * 3) {
    return rejection("rescue_route_unreachable");
  }
  if (input.geometry.rescueRoute && !rescueRoute) return rejection("rescue_route_unreachable");
  if (input.geometry.surfaceExit !== surfaceExit || input.geometry.rescueRoute !== rescueRoute || input.geometry.flooded !== flooded) return rejection("geometry_claim_mismatch");
  if (!surfaceExit && !rescueRoute) return rejection("safe_exit_required");
  if (!/^\d+$/.test(input.creationKai) || !input.priorGraphHead) return rejection("evidence_invalid");
  if (input.access.mode !== "invited" && input.access.invitedSubjectIds.length) return rejection("access_policy_invalid");
  if (input.access.mode === "invited" && input.access.invitedSubjectIds.length === 0) return rejection("access_policy_invalid");
  if (input.access.mode !== "public") return rejection("private_access_envelope_required");
  if (flooded) {
    const support: CreatureSpecialtyFamily[] = ["swim", "dive", "current", "resist", "anchor"];
    if (!support.every((family) => familyAvailable(input.capability, family))) return rejection("submerged_support_required");
  }

  const families = immutable([...new Set(input.capability.identity.specialties
    .filter((specialty) => familyAvailable(input.capability, specialty.family))
    .map((specialty) => specialty.family))].sort());
  const basis = {
    schema: "wildz.excavation.preview.v1" as const,
    physical: false as const,
    worldId: input.worldId,
    siteKey: input.siteKey,
    actorSubjectId: input.actorSubjectId,
    creatureSubjectId: input.creatureSubjectId,
    creator: { ...input.creator },
    creature: { ...input.creature },
    capability: {
      identityDigest: digest(input.capability.identity),
      conditionDigest: input.capability.conditionDigest,
      families
    },
    substrate: input.substrate,
    geometry: { ...input.geometry, from: { ...input.geometry.from }, to: { ...input.geometry.to } },
    safety: immutable({
      protectedVolumes: input.safety.protectedVolumes.map((volume) => ({ ...volume, center: { ...volume.center }, halfExtents: { ...volume.halfExtents } })),
      canonicalRoutes: input.safety.canonicalRoutes.map((route) => ({ ...route, points: route.points.map((point) => ({ ...point })) })),
      rescueAnchor: { ...input.safety.rescueAnchor }
    }),
    safetyDigest: digest(input.safety),
    physicalAuthority: immutable({
      ...input.physicalAuthority,
      safetyDigest: digest(input.safety),
      substrate: input.substrate,
      surfaceExit,
      rescueRoute,
      flooded
    }),
    access: { mode: input.access.mode, grantsDigest: digest({ mode: input.access.mode, invitedSubjectIds: [...new Set(input.access.invitedSubjectIds)].sort() }) },
    creationKai: input.creationKai,
    priorGraphHead: input.priorGraphHead
  };
  const candidateEventDigest = digest({ ...basis, domainRegistryDigest: WILDS_EXCAVATION_REGISTRY_DIGEST, domainReducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST });
  const idempotencyKey = `wildz.excavation.v1:${digest({ basis, candidateEventDigest }).slice(-32)}`;
  if (input.idempotencyKey && input.idempotencyKey !== idempotencyKey) return rejection("idempotency_key_invalid");
  const preview = immutable({ ...basis, previewDigest: digest(basis), candidateEventDigest, idempotencyKey });
  return immutable({ ok: true, preview });
}

export function emptyWildsExcavationGraph(worldId: string, receizWorldHead = "receiz.world.genesis") : WildsExcavationGraph {
  const head = digest({ schema: "wildz.excavation.graph.genesis.v1", worldId, receizWorldHead, reducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST });
  return immutable({ schema: "wildz.excavation.graph.v1", worldId, receizWorldHead, head, events: [], segments: [], chambers: [], idempotencyKeys: [] });
}

function excavationPayload(preview: WildsExcavationPreview) {
  const authorityPreview = immutable({
    schema: preview.schema,
    physical: false as const,
    previewDigest: preview.previewDigest,
    worldId: preview.worldId,
    siteKey: preview.siteKey,
    actorSubjectId: preview.actorSubjectId,
    creatureSubjectId: preview.creatureSubjectId,
    capability: preview.capability,
    substrate: preview.substrate,
    geometry: preview.geometry,
    safetyDigest: preview.safetyDigest,
    physicalAuthority: preview.physicalAuthority,
    access: { mode: "public" as const },
    creationKai: preview.creationKai,
    priorGraphHead: preview.priorGraphHead,
    idempotencyKey: preview.idempotencyKey,
    candidateEventDigest: preview.candidateEventDigest
  });
  return immutable({
    schema: "wildz.excavation.command_payload.v1",
    applicationId: "wildz.quest",
    worldRegion: preview.siteKey,
    domainRegistryDigest: WILDS_EXCAVATION_REGISTRY_DIGEST,
    domainReducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST,
    priorGraphHead: preview.priorGraphHead,
    candidateEventDigest: preview.candidateEventDigest,
    preview: authorityPreview
  });
}

function creatureLaborPayload(preview: WildsExcavationPreview) {
  return immutable({
    schema: "wildz.excavation.creature_labor_payload.v1",
    applicationId: "wildz.quest",
    worldRegion: preview.siteKey,
    candidateEventDigest: preview.candidateEventDigest,
    creatureIdentityDigest: preview.capability.identityDigest,
    creatureConditionDigest: preview.capability.conditionDigest,
    explorerSubjectId: preview.actorSubjectId
  });
}

function transactionEventPayload(commandPlans: readonly ReceizWorldCommandPlanV1[]) {
  return immutable({ commands: commandPlans.map((plan) => plan.command.input) });
}

function exactKeys(value: Readonly<Record<string, string>>, expected: readonly string[]) {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function rejectAdmission(graph: WildsExcavationGraph, code: string): AdmissionResult {
  return immutable({ ok: false, code, writes: 0, graph });
}

function zeroWriteFailureValid(
  result: Extract<ReceizWorldExecutionResultV1, { ok: false }>,
  transaction: ReceizWorldTransactionV1,
  attemptId: string
) {
  return result.schema === "receiz.world.zero-write-failure.v1"
    && result.writes === 0
    && result.commandId === transaction.transactionId
    && result.attemptId === attemptId
    && result.registryDigest === transaction.registryDigest
    && result.reducerDigest === transaction.reducerDigest
    && typeof result.worldHead === "string"
    && exactKeys(result.currentHeads, transaction.participants);
}

function pendingAdmissionValid(graph: WildsExcavationGraph, pending: WildsExcavationPendingAdmission, idempotencyKey: string) {
  const preview = pending.preview;
  if (pending.schema !== "wildz.excavation.pending_admission.v1"
    || pending.graphHead !== graph.head
    || preview.worldId !== graph.worldId
    || preview.priorGraphHead !== graph.head
    || preview.idempotencyKey !== idempotencyKey
    || !domainPreviewValid(preview)) return false;
  const participants = [preview.actorSubjectId, preview.creatureSubjectId].sort();
  const plans = pending.commandPlans;
  if (plans.length !== 2 || pending.transaction.schema !== "receiz.world.transaction.v1"
    || pending.transaction.worldId !== graph.worldId
    || JSON.stringify(pending.transaction.participants) !== JSON.stringify(participants)
    || canonicalPortableCardJson(pending.transaction.expectedHeads) !== canonicalPortableCardJson(plans[0].priorHeads)
    || canonicalPortableCardJson(pending.transaction.commands) !== canonicalPortableCardJson(plans.map((plan) => plan.command))) return false;
  const expectedInputs = [
    {
      worldId: preview.worldId, actorSubjectId: preview.actorSubjectId, kind: "wildz.excavation.append.v1",
      targetIds: [preview.creatureSubjectId], payload: excavationPayload(preview)
    },
    {
      worldId: preview.worldId, actorSubjectId: preview.creatureSubjectId, kind: "wildz.excavation.creature_labor.v1",
      targetIds: [preview.actorSubjectId], payload: creatureLaborPayload(preview)
    }
  ];
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index]!;
    const commandInput = plan.command.input;
    const expected = expectedInputs[index]!;
    if (plan.schema !== "receiz.world.command_plan.v1" || plan.writesOnFailure !== 0
      || plan.planId !== plan.command.commandId
      || plan.worldHead !== graph.receizWorldHead
      || canonicalPortableCardJson(plan.priorHeads) !== canonicalPortableCardJson(pending.transaction.expectedHeads)
      || commandInput.worldId !== expected.worldId || commandInput.actorSubjectId !== expected.actorSubjectId
      || commandInput.kind !== expected.kind || canonicalPortableCardJson(commandInput.targetIds) !== canonicalPortableCardJson(expected.targetIds)
      || canonicalPortableCardJson(commandInput.payload) !== canonicalPortableCardJson(expected.payload)
      || canonicalPortableCardJson(commandInput.expectedHeads) !== canonicalPortableCardJson(pending.transaction.expectedHeads)
      || commandInput.expectedWorldHead !== graph.receizWorldHead
      || commandInput.idempotencyKey !== idempotencyKey
      || commandInput.attemptId !== plans[0].command.input.attemptId
      || plan.registryDigest !== pending.transaction.registryDigest
      || plan.reducerDigest !== pending.transaction.reducerDigest) return false;
  }
  return true;
}

function segmentIntersects(existing: WildsExcavationSegment, preview: WildsExcavationPreview) {
  return segmentDistance(existing.from, existing.to, preview.geometry.from, preview.geometry.to) < existing.radius + preview.geometry.radius;
}

function previewBasis(preview: WildsExcavationPreview) {
  const { previewDigest: _previewDigest, candidateEventDigest: _candidateEventDigest, idempotencyKey: _idempotencyKey, ...basis } = preview;
  return basis;
}

function canonicalPreviewRulesValid(preview: WildsExcavationPreview) {
  try {
    if (preview.worldId !== wildsExcavationWorldIdForSite(preview.siteKey)) return false;
  } catch {
    return false;
  }
  const { from, to, radius } = preview.geometry;
  const bounds = siteRegionBounds(preview.siteKey);
  if (![from, to].every((point) => finitePoint(point)
    && point.x >= bounds.minX && point.x < bounds.maxX
    && point.z >= bounds.minZ && point.z < bounds.maxZ)
    || !Number.isFinite(radius) || radius < .9 || radius > 3) return false;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const horizontal = Math.hypot(dx, dz);
  const length = Math.hypot(dx, dy, dz);
  if (length < 2 || length > MAX_SEGMENT_LENGTH || horizontal === 0 || Math.abs(dy) / horizontal > .75) return false;
  if (preview.safetyDigest !== digest(preview.safety)
    || !finitePoint(preview.safety.rescueAnchor)
    || preview.safety.protectedVolumes.some((volume) => !finitePoint(volume.center)
      || !finitePoint(volume.halfExtents)
      || volume.halfExtents.x < 0 || volume.halfExtents.y < 0 || volume.halfExtents.z < 0
      || segmentIntersectsAabb(from, to, volume.center, {
        x: volume.halfExtents.x + radius,
        y: volume.halfExtents.y + radius,
        z: volume.halfExtents.z + radius
      }))
    || preview.safety.canonicalRoutes.some((route) => route.points.length < 2
      || route.points.some((point) => !finitePoint(point))
      || route.points.some((point, index) => index > 0
        && segmentDistance(route.points[index - 1]!, point, from, to) <= radius + 1 + 1e-7))) return false;
  const { surfaceExit, rescueRoute, flooded } = preview.physicalAuthority;
  if (preview.geometry.surfaceExit !== surfaceExit || preview.geometry.rescueRoute !== rescueRoute
    || preview.geometry.flooded !== flooded || preview.substrate !== preview.physicalAuthority.substrate
    || preview.safetyDigest !== preview.physicalAuthority.safetyDigest
    || !preview.physicalAuthority.projectionDigest || !preview.physicalAuthority.spaceId
    || (!surfaceExit && !rescueRoute)) return false;
  if (rescueRoute && Math.min(distance(preview.safety.rescueAnchor, from), distance(preview.safety.rescueAnchor, to)) > radius * 3) return false;
  if (!preview.capability.families.includes("burrow")
    || (preview.substrate === "rock" && !preview.capability.families.includes("break"))) return false;
  if (flooded && !(["swim", "dive", "current", "resist", "anchor"] as const)
    .every((family) => preview.capability.families.includes(family))) return false;
  return preview.schema === "wildz.excavation.preview.v1" && preview.physical === false
    && preview.access.mode === "public" && /^\d+$/.test(preview.creationKai) && Boolean(preview.priorGraphHead);
}

function domainPreviewValid(preview: WildsExcavationPreview) {
  const basis = previewBasis(preview);
  const candidateEventDigest = digest({ ...basis, domainRegistryDigest: WILDS_EXCAVATION_REGISTRY_DIGEST, domainReducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST });
  return canonicalPreviewRulesValid(preview)
    && preview.previewDigest === digest(basis)
    && preview.candidateEventDigest === candidateEventDigest
    && preview.idempotencyKey === `wildz.excavation.v1:${digest({ basis, candidateEventDigest }).slice(-32)}`;
}

function domainEventValid(graph: WildsExcavationGraph, event: WildsExcavationEvent) {
  const basis = previewBasis(event.preview);
  const previewDigest = digest(basis);
  const candidateEventDigest = digest({ ...basis, domainRegistryDigest: WILDS_EXCAVATION_REGISTRY_DIGEST, domainReducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST });
  const idempotencyKey = `wildz.excavation.v1:${digest({ basis, candidateEventDigest }).slice(-32)}`;
  const graphHead = digest({
    schema: "wildz.excavation.graph.append.v1",
    priorGraphHead: graph.head,
    candidateEventDigest,
    receizEventId: event.eventId,
    receizWorldHead: event.receizWorldHead,
    reducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST
  });
  return event.schema === "wildz.excavation.event.v1"
    && event.worldId === graph.worldId
    && event.registryDigest === WILDS_EXCAVATION_REGISTRY_DIGEST
    && event.reducerDigest === WILDS_EXCAVATION_REDUCER_DIGEST
    && event.priorGraphHead === graph.head
    && event.receizPriorWorldHead === graph.receizWorldHead
    && domainPreviewValid(event.preview)
    && event.preview.previewDigest === previewDigest
    && event.preview.candidateEventDigest === candidateEventDigest
    && event.candidateEventDigest === candidateEventDigest
    && event.preview.idempotencyKey === idempotencyKey
    && event.idempotencyKey === idempotencyKey
    && event.graphHead === graphHead;
}

function appendEvent(graph: WildsExcavationGraph, event: WildsExcavationEvent, evidenceVerified: boolean) {
  if (!evidenceVerified) throw new Error("wilds_excavation_evidence_unverified");
  if (graph.idempotencyKeys.includes(event.idempotencyKey)) return graph;
  if (!domainEventValid(graph, event)) throw new Error("wilds_excavation_domain_event_invalid");
  if (graph.events.some((existing) => existing.eventId === event.eventId || existing.commandId === event.commandId)) throw new Error("wilds_excavation_event_replay_conflict");
  if (graph.segments.some((segment) => segmentIntersects(segment, event.preview))) throw new Error("wilds_excavation_geometry_conflict");
  const segment: WildsExcavationSegment = immutable({
    id: `wildz.excavation.segment.v1:${event.candidateEventDigest.slice(-24)}`,
    siteKey: event.preview.siteKey,
    from: event.preview.geometry.from,
    to: event.preview.geometry.to,
    radius: event.preview.geometry.radius,
    flooded: event.preview.geometry.flooded,
    access: event.preview.access,
    ownerSubjectId: event.preview.actorSubjectId,
    creator: event.preview.creator,
    creature: event.preview.creature,
    creationKai: event.preview.creationKai,
    steward: event.preview.creator,
    sourceEventId: event.eventId
  });
  return immutable({
    ...graph,
    receizWorldHead: event.receizWorldHead,
    head: event.graphHead,
    events: [...graph.events, event],
    segments: [...graph.segments, segment],
    idempotencyKeys: [...graph.idempotencyKeys, event.idempotencyKey]
  });
}

export function replayWildsExcavationEvents(
  base: WildsExcavationGraph,
  events: readonly WildsExcavationEvent[],
  verifyEvidence: (event: WildsExcavationEvent) => boolean
) {
  return events.reduce((graph, event) => appendEvent(graph, event, verifyEvidence(event)), base);
}

function validateSuccess(input: Readonly<{
  result: ReceizWorldExecutionResultV1;
  transaction: ReceizWorldTransactionV1;
  commandPlans: readonly [ReceizWorldCommandPlanV1, ReceizWorldCommandPlanV1];
  preview: WildsExcavationPreview;
  graph: WildsExcavationGraph;
}>) {
  const { result, transaction, commandPlans, preview, graph } = input;
  if (!result.ok) return null;
  const participants = [...transaction.participants].sort();
  if (result.receipt.commandId !== transaction.transactionId
    || result.receipt.attemptId !== commandPlans[0].command.input.attemptId
    || result.receipt.registryDigest !== transaction.registryDigest
    || result.receipt.reducerDigest !== transaction.reducerDigest
    || result.receipt.schema !== "receiz.world.receipt.v1"
    || result.receipt.actorSubjectId !== preview.actorSubjectId
    || result.receipt.eventIds.length !== 1
    || result.events.length !== 1
    || !exactKeys(result.receipt.priorHeads, participants)
    || !exactKeys(result.receipt.nextHeads, participants)
    || canonicalPortableCardJson(result.receipt.priorHeads) !== canonicalPortableCardJson(transaction.expectedHeads)) return null;
  const worldEvent = result.events[0]!;
  const causalParents = [graph.receizWorldHead, ...Object.values(transaction.expectedHeads)];
  if (worldEvent.eventId !== result.receipt.eventIds[0]
    || worldEvent.commandId !== transaction.transactionId
    || worldEvent.worldId !== preview.worldId
    || worldEvent.schema !== "receiz.world.event.v1"
    || worldEvent.kind !== "world.transaction"
    || worldEvent.actorSubjectId !== preview.actorSubjectId
    || worldEvent.priorWorldHead !== graph.receizWorldHead
    || worldEvent.worldHead !== result.receipt.worldHead
    || worldEvent.registryDigest !== transaction.registryDigest
    || worldEvent.reducerDigest !== transaction.reducerDigest
    || JSON.stringify([...worldEvent.participantSubjectIds].sort()) !== JSON.stringify(participants)
    || canonicalPortableCardJson(worldEvent.priorHeads) !== canonicalPortableCardJson(transaction.expectedHeads)
    || canonicalPortableCardJson(worldEvent.nextHeads) !== canonicalPortableCardJson(result.receipt.nextHeads)
    || canonicalPortableCardJson(worldEvent.causalParents) !== canonicalPortableCardJson(causalParents)
    || worldEvent.kai !== result.receipt.kai
    || canonicalPortableCardJson(worldEvent.payload) !== canonicalPortableCardJson(transactionEventPayload(commandPlans))) return null;
  const graphHead = digest({
    schema: "wildz.excavation.graph.append.v1",
    priorGraphHead: graph.head,
    candidateEventDigest: preview.candidateEventDigest,
    receizEventId: worldEvent.eventId,
    receizWorldHead: worldEvent.worldHead,
    reducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST
  });
  return immutable({
    schema: "wildz.excavation.event.v1" as const,
    eventId: worldEvent.eventId,
    commandId: worldEvent.commandId,
    worldId: worldEvent.worldId,
    priorGraphHead: graph.head,
    graphHead,
    receizPriorWorldHead: worldEvent.priorWorldHead,
    receizWorldHead: worldEvent.worldHead,
    idempotencyKey: preview.idempotencyKey,
    candidateEventDigest: preview.candidateEventDigest,
    preview,
    registryDigest: WILDS_EXCAVATION_REGISTRY_DIGEST,
    reducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST
  });
}

export async function executeWildsExcavationAdmission(input: Readonly<{
  graph: WildsExcavationGraph;
  preview: WildsExcavationPreview;
  expectedHeads: Readonly<Record<string, string>>;
  authority: ReceizWorldTransactionAuthorityV1;
  attemptId: string;
  rail: WildsExcavationReceizPort;
  journal: WildsExcavationAdmissionJournal;
}>): Promise<AdmissionResult> {
  const { graph, preview } = input;
  if (preview.worldId !== graph.worldId) return rejectAdmission(graph, "world_mismatch");
  if (!domainPreviewValid(preview)) return rejectAdmission(graph, "preview_invalid");
  if (graph.idempotencyKeys.includes(preview.idempotencyKey)) return immutable({ ok: true, graph, receiptId: graph.events.find((event) => event.idempotencyKey === preview.idempotencyKey)!.eventId });
  if (preview.priorGraphHead !== graph.head) return rejectAdmission(graph, "stale_graph_head");
  if (graph.segments.some((segment) => segmentIntersects(segment, preview))) return rejectAdmission(graph, "geometry_conflict");
  const participants = [preview.actorSubjectId, preview.creatureSubjectId].sort();
  if (!exactKeys(input.expectedHeads, participants) || !exactKeys(input.authority.authorities as unknown as Record<string, string>, participants)) return rejectAdmission(graph, "participant_set_invalid");
  if (participants.some((subjectId) => input.authority.authorities[subjectId]?.actorSubjectId !== subjectId)) return rejectAdmission(graph, "participant_authority_invalid");
  let sdkRegistryDigest: string | null = null;
  let sdkReducerDigest: string | null = null;
  const resolvedSubjects = new Map<string, Awaited<ReturnType<WildsExcavationReceizPort["resolveSubject"]>>>();
  let canonicalPhysicalEvidence: WildsExcavationPhysicalEvidence;
  try {
    for (const subjectId of participants) {
      const subject = await input.rail.resolveSubject(subjectId);
      if (subject.subjectId !== subjectId || subject.head !== input.expectedHeads[subjectId]) return rejectAdmission(graph, "participant_head_invalid");
      sdkRegistryDigest ??= subject.registryDigest;
      sdkReducerDigest ??= subject.reducerDigest;
      if (subject.registryDigest !== sdkRegistryDigest || subject.reducerDigest !== sdkReducerDigest) return rejectAdmission(graph, "participant_runtime_mismatch");
      resolvedSubjects.set(subjectId, subject);
    }
    canonicalPhysicalEvidence = await input.rail.resolvePhysicalEvidence(preview);
  } catch {
    return rejectAdmission(graph, "participant_evidence_unavailable");
  }
  const resolvedExplorer = resolvedSubjects.get(preview.actorSubjectId)!;
  const resolvedCreature = resolvedSubjects.get(preview.creatureSubjectId)!;
  const normalizeDigest = (value: string) => value.replace(/^sha256:/, "");
  if (resolvedExplorer.proofObjectId !== preview.creator.proofObjectId
    || normalizeDigest(resolvedExplorer.identityDigest) !== normalizeDigest(preview.creator.proofDigest)
    || resolvedCreature.proofObjectId !== preview.creature.proofObjectId
    || normalizeDigest(resolvedCreature.identityDigest) !== normalizeDigest(preview.creature.proofDigest)
    || resolvedCreature.capabilityIdentityDigest !== preview.capability.identityDigest
    || resolvedCreature.conditionDigest !== preview.capability.conditionDigest
    || canonicalPortableCardJson(canonicalPhysicalEvidence) !== canonicalPortableCardJson(preview.physicalAuthority)
    || participants.some((subjectId) => input.authority.authorities[subjectId]?.ownerReceizId !== resolvedSubjects.get(subjectId)!.currentOwnerReceizId)) {
    return rejectAdmission(graph, "participant_proof_authority_invalid");
  }
  const explorerCommandInput: ReceizWorldCommandInputV1 = immutable({
    worldId: preview.worldId,
    actorSubjectId: preview.actorSubjectId,
    kind: "wildz.excavation.append.v1",
    targetIds: [preview.creatureSubjectId],
    payload: excavationPayload(preview),
    expectedHeads: input.expectedHeads,
    expectedWorldHead: graph.receizWorldHead,
    attemptId: input.attemptId,
    idempotencyKey: preview.idempotencyKey
  });
  const creatureCommandInput: ReceizWorldCommandInputV1 = immutable({
    worldId: preview.worldId,
    actorSubjectId: preview.creatureSubjectId,
    kind: "wildz.excavation.creature_labor.v1",
    targetIds: [preview.actorSubjectId],
    payload: creatureLaborPayload(preview),
    expectedHeads: input.expectedHeads,
    expectedWorldHead: graph.receizWorldHead,
    attemptId: input.attemptId,
    idempotencyKey: preview.idempotencyKey
  });
  let commandPlans: readonly [ReceizWorldCommandPlanV1, ReceizWorldCommandPlanV1];
  let transaction: ReceizWorldTransactionV1;
  try {
    commandPlans = immutable([
      await input.rail.planCommand(explorerCommandInput),
      await input.rail.planCommand(creatureCommandInput)
    ]);
    for (const [index, commandPlan] of commandPlans.entries()) {
      const expectedInput = index === 0 ? explorerCommandInput : creatureCommandInput;
      if (commandPlan.schema !== "receiz.world.command_plan.v1"
        || commandPlan.writesOnFailure !== 0
        || commandPlan.worldHead !== graph.receizWorldHead
        || commandPlan.registryDigest !== sdkRegistryDigest
        || commandPlan.reducerDigest !== sdkReducerDigest
        || canonicalPortableCardJson(commandPlan.priorHeads) !== canonicalPortableCardJson(input.expectedHeads)
        || canonicalPortableCardJson(commandPlan.command.input) !== canonicalPortableCardJson(expectedInput)) return rejectAdmission(graph, "command_plan_invalid");
      const validation = await input.rail.validateCommand(commandPlan);
      if (!validation.ok || validation.writes !== 0 || validation.planDigest !== commandPlan.planDigest) return rejectAdmission(graph, "command_plan_rejected");
    }
    transaction = await input.rail.planTransaction({ participants, expectedHeads: input.expectedHeads, commands: commandPlans.map((plan) => plan.command) });
    if (transaction.worldId !== preview.worldId
      || transaction.schema !== "receiz.world.transaction.v1"
      || canonicalPortableCardJson(transaction.expectedHeads) !== canonicalPortableCardJson(input.expectedHeads)
      || JSON.stringify(transaction.participants) !== JSON.stringify(participants)
      || canonicalPortableCardJson(transaction.commands) !== canonicalPortableCardJson(commandPlans.map((plan) => plan.command))
      || transaction.registryDigest !== commandPlans[0].registryDigest
      || transaction.reducerDigest !== commandPlans[0].reducerDigest) return rejectAdmission(graph, "transaction_plan_invalid");
    await input.journal.stage(immutable({
      schema: "wildz.excavation.pending_admission.v1",
      preview,
      graphHead: graph.head,
      commandPlans,
      transaction
    }));
  } catch {
    return rejectAdmission(graph, "receiz_plan_unavailable");
  }
  let result: ReceizWorldExecutionResultV1;
  try {
    result = await input.rail.executeTransaction(transaction, input.authority);
  } catch {
    return rejectAdmission(graph, "receiz_outcome_ambiguous");
  }
  if (!result.ok) {
    if (!zeroWriteFailureValid(result, transaction, input.attemptId)) return rejectAdmission(graph, "receiz_failure_invalid");
    await input.journal.remove(preview.worldId, preview.idempotencyKey);
    return rejectAdmission(graph, result.code);
  }
  const event = validateSuccess({ result, transaction, commandPlans, preview, graph });
  if (!event) return rejectAdmission(graph, "receiz_receipt_invalid");
  try {
    const next = immutable({ ok: true as const, graph: appendEvent(graph, event, true), receiptId: result.receipt.receiptId });
    await input.journal.remove(preview.worldId, preview.idempotencyKey);
    return next;
  } catch (error) {
    return rejectAdmission(graph, error instanceof Error ? error.message : "graph_append_invalid");
  }
}

export function projectWildsExcavationPhysicalGraph(
  graph: WildsExcavationGraph,
  viewerAccess: WildsExcavationViewerAccess = ANONYMOUS_VIEWER_ACCESS
) {
  let graphCache = physicalGraphCache.get(graph);
  const cached = graphCache?.get(viewerAccess);
  if (cached) return cached;
  const segments = graph.segments.filter((segment) => compileWildsExcavationAccess({
    access: segment.access,
    actorSubjectId: viewerAccess.actorSubjectId,
    ownerSubjectId: segment.ownerSubjectId,
    privateGrant: viewerAccess.grants.get(segment.access.grantsDigest) ?? null
  }).enterable).map((segment) => immutable({
    id: segment.id,
    siteKey: segment.siteKey,
    from: segment.from,
    to: segment.to,
    radius: segment.radius,
    flooded: segment.flooded,
    accessMode: segment.access.mode
  }));
  const projection = immutable({ segments, chambers: graph.chambers });
  physicalGraphBuilds += 1;
  if (!graphCache) {
    graphCache = new WeakMap();
    physicalGraphCache.set(graph, graphCache);
  }
  graphCache.set(viewerAccess, projection);
  while (physicalGraphCache.size > PHYSICAL_CACHE_LIMIT) {
    const oldest = physicalGraphCache.keys().next().value as WildsExcavationGraph | undefined;
    if (oldest === undefined) break;
    physicalGraphCache.delete(oldest);
  }
  return projection;
}

export function wildsExcavationDiagnostics() {
  return immutable({ physicalGraphBuilds, viewerAccessBuilds, physicalGraphCacheSize: physicalGraphCache.size });
}

export function compileWildsExcavationViewerAccess(
  actorSubjectId: string | null,
  privateGrants: readonly Readonly<{ grantsDigest: string; actorSubjectId: string; admitted: boolean; revoked: boolean }>[]
): WildsExcavationViewerAccess {
  if (actorSubjectId === null && privateGrants.length === 0) return ANONYMOUS_VIEWER_ACCESS;
  const grants = new Map<string, Readonly<{ grantsDigest: string; actorSubjectId: string; admitted: boolean; revoked: boolean }>>();
  for (const grant of privateGrants) {
    if (grant.actorSubjectId === actorSubjectId) grants.set(grant.grantsDigest, immutable({
      grantsDigest: grant.grantsDigest,
      actorSubjectId: grant.actorSubjectId,
      admitted: grant.admitted,
      revoked: grant.revoked
    }));
  }
  viewerAccessBuilds += 1;
  return immutable({ actorSubjectId, grants });
}

export function projectWildsExcavationPublicFeatureRefs(graph: WildsExcavationGraph) {
  return immutable(graph.segments.filter((segment) => segment.access.mode === "public").map((segment) => ({
    schema: "wildz.excavation.public_feature_ref.v1" as const,
    featureId: segment.id,
    featureHead: graph.head,
    siteKey: segment.siteKey,
    entrance: segment.from,
    flooded: segment.flooded,
    access: "public" as const
  })));
}

export function compileWildsExcavationAccess(input: Readonly<{
  access: AccessPolicy;
  actorSubjectId: string | null;
  ownerSubjectId: string;
  privateGrant: Readonly<{ grantsDigest: string; actorSubjectId: string; admitted: boolean; revoked: boolean }> | null;
}>) {
  const owner = input.actorSubjectId === input.ownerSubjectId;
  const invited = input.privateGrant !== null
    && input.privateGrant.grantsDigest === input.access.grantsDigest
    && input.privateGrant.actorSubjectId === input.actorSubjectId
    && input.privateGrant.admitted
    && !input.privateGrant.revoked;
  const enterable = input.access.mode === "public" || owner || (input.access.mode === "invited" && invited);
  return immutable({ visible: input.access.mode === "public" || enterable, enterable, markerDetail: input.access.mode === "public" && enterable });
}

export function projectWildsExcavationMakerMark(input: Readonly<{
  access: AccessPolicy;
  creatorPublication: Readonly<{ publicAlias: string | null; public: boolean; publicationHead: string }>;
  creature: Readonly<{ proofDigest: string; publicName: string | null }>;
  stewardPublication: Readonly<{ publicAlias: string | null; public: boolean; publicationHead: string }>;
  creationKai: string;
  entrance: Point3;
  biome: string;
}>, distance: number) {
  if (input.access.mode !== "public" || !Number.isFinite(distance) || distance > 14) return null;
  const interactionRange = distance <= 4;
  const creator = interactionRange && input.creatorPublication.public ? input.creatorPublication.publicAlias : null;
  const steward = interactionRange && input.stewardPublication.public ? input.stewardPublication.publicAlias : null;
  const details = interactionRange ? immutable({ route: "Verified public route", creator, creature: input.creature.publicName, creationKai: input.creationKai, steward }) : null;
  return immutable({ schema: "wildz.excavation.maker_mark.v1" as const, form: input.biome === "water" ? "buoy" : input.biome === "stone" ? "etched-stone" : "timber", creator, steward, details });
}

export type WildsExcavationMaterialParticipant = Readonly<{
  subjectId: string;
  expectedHead: string;
  plannedCommand: ReceizWorldCommandPlanV1;
}>;

export function requireTask9MaterialParticipants(participants: readonly WildsExcavationMaterialParticipant[]) {
  if (participants.length === 0) return immutable({ ready: false as const, code: "task9_material_participants_required", writes: 0 as const });
  return immutable({ ready: true as const, participants: [...participants] });
}

export function createWildsExcavationReceizPort(
  client: Pick<ReceizClient, "subjects" | "world">,
  resolveCapabilityEvidence: (subjectId: string, subjectHead: string) => Promise<Readonly<{ capabilityIdentityDigest: string | null; conditionDigest: string | null }>>,
  resolvePhysicalEvidence: (preview: WildsExcavationPreview) => Promise<WildsExcavationPhysicalEvidence>
): WildsExcavationReceizPort {
  return immutable({
    async resolveSubject(subjectId: string) {
      const artifact = await client.subjects.resolve(subjectId);
      const capability = await resolveCapabilityEvidence(subjectId, artifact.subject.head);
      return immutable({
        subjectId: artifact.subject.subjectId,
        head: artifact.subject.head,
        registryDigest: artifact.registryDigest,
        reducerDigest: artifact.reducerDigest,
        proofObjectId: artifact.subject.proofObjectId,
        identityDigest: artifact.subject.identityDigest,
        currentOwnerReceizId: artifact.subject.currentOwnerReceizId,
        capabilityIdentityDigest: capability.capabilityIdentityDigest,
        conditionDigest: capability.conditionDigest
      });
    },
    resolvePhysicalEvidence,
    planCommand: client.world.planCommand.bind(client.world),
    validateCommand: client.world.validateCommand.bind(client.world),
    planTransaction: client.world.planTransaction.bind(client.world),
    executeTransaction: client.world.executeTransaction.bind(client.world),
    additions: client.world.additions.bind(client.world)
  });
}

export async function recoverWildsExcavationAdmission(input: Readonly<{
  graph: WildsExcavationGraph;
  idempotencyKey: string;
  authority: ReceizWorldTransactionAuthorityV1;
  rail: WildsExcavationReceizPort;
  journal: WildsExcavationAdmissionJournal;
}>): Promise<AdmissionResult> {
  const pending = await input.journal.read(input.graph.worldId, input.idempotencyKey);
  if (!pending) return rejectAdmission(input.graph, "pending_admission_not_found");
  if (!pendingAdmissionValid(input.graph, pending, input.idempotencyKey)) return rejectAdmission(input.graph, "pending_admission_invalid");
  const participants = [pending.preview.actorSubjectId, pending.preview.creatureSubjectId].sort();
  if (!exactKeys(input.authority.authorities as unknown as Record<string, string>, participants)
    || participants.some((subjectId) => input.authority.authorities[subjectId]?.actorSubjectId !== subjectId)) return rejectAdmission(input.graph, "participant_authority_invalid");
  const additions = await input.rail.additions({
    worldId: input.graph.worldId,
    afterHead: pending.commandPlans[0].worldHead
  });
  const existing = additions.find((event) => event.commandId === pending.transaction.transactionId);
  if (existing) {
    const candidate = validateRecoveredWorldEvent(input.graph, pending, existing);
    if (!candidate) return rejectAdmission(input.graph, "receiz_recovered_event_invalid");
    try {
      const graph = appendEvent(input.graph, candidate, true);
      await input.journal.remove(input.graph.worldId, input.idempotencyKey);
      return immutable({ ok: true, graph, receiptId: `recovered:${existing.eventId}` });
    } catch {
      return rejectAdmission(input.graph, "receiz_recovered_graph_invalid");
    }
  }
  try {
    const resolved = new Map<string, Awaited<ReturnType<WildsExcavationReceizPort["resolveSubject"]>>>();
    for (const subjectId of participants) {
      const subject = await input.rail.resolveSubject(subjectId);
      if (subject.subjectId !== subjectId || subject.head !== pending.transaction.expectedHeads[subjectId]
        || input.authority.authorities[subjectId]?.ownerReceizId !== subject.currentOwnerReceizId) {
        return rejectAdmission(input.graph, "pending_participant_evidence_invalid");
      }
      resolved.set(subjectId, subject);
    }
    const explorer = resolved.get(pending.preview.actorSubjectId)!;
    const creature = resolved.get(pending.preview.creatureSubjectId)!;
    const normalizeDigest = (value: string) => value.replace(/^sha256:/, "");
    const physical = await input.rail.resolvePhysicalEvidence(pending.preview);
    if (explorer.proofObjectId !== pending.preview.creator.proofObjectId
      || normalizeDigest(explorer.identityDigest) !== normalizeDigest(pending.preview.creator.proofDigest)
      || creature.proofObjectId !== pending.preview.creature.proofObjectId
      || normalizeDigest(creature.identityDigest) !== normalizeDigest(pending.preview.creature.proofDigest)
      || creature.capabilityIdentityDigest !== pending.preview.capability.identityDigest
      || creature.conditionDigest !== pending.preview.capability.conditionDigest
      || canonicalPortableCardJson(physical) !== canonicalPortableCardJson(pending.preview.physicalAuthority)) {
      return rejectAdmission(input.graph, "pending_participant_evidence_invalid");
    }
  } catch {
    return rejectAdmission(input.graph, "pending_participant_evidence_unavailable");
  }
  for (const commandPlan of pending.commandPlans) {
    const validation = await input.rail.validateCommand(commandPlan);
    if (!validation.ok || validation.writes !== 0 || validation.planDigest !== commandPlan.planDigest) {
      return rejectAdmission(input.graph, "pending_admission_unresolved");
    }
  }
  let result: ReceizWorldExecutionResultV1;
  try {
    result = await input.rail.executeTransaction(pending.transaction, input.authority);
  } catch {
    return rejectAdmission(input.graph, "receiz_outcome_ambiguous");
  }
  if (!result.ok) {
    if (!zeroWriteFailureValid(result, pending.transaction, pending.commandPlans[0].command.input.attemptId)) return rejectAdmission(input.graph, "receiz_failure_invalid");
    await input.journal.remove(input.graph.worldId, input.idempotencyKey);
    return rejectAdmission(input.graph, result.code);
  }
  const candidate = validateSuccess({
    result,
    transaction: pending.transaction,
    commandPlans: pending.commandPlans,
    preview: pending.preview,
    graph: input.graph
  });
  if (!candidate) return rejectAdmission(input.graph, "receiz_receipt_invalid");
  const graph = appendEvent(input.graph, candidate, true);
  await input.journal.remove(input.graph.worldId, input.idempotencyKey);
  return immutable({ ok: true, graph, receiptId: result.receipt.receiptId });
}

function validateRecoveredWorldEvent(
  graph: WildsExcavationGraph,
  pending: WildsExcavationPendingAdmission,
  worldEvent: Awaited<ReturnType<ReceizClient["world"]["additions"]>>[number]
) {
  const participants = [...pending.transaction.participants].sort();
  const causalParents = [graph.receizWorldHead, ...Object.values(pending.transaction.expectedHeads)];
  if (worldEvent.schema !== "receiz.world.event.v1"
    || worldEvent.commandId !== pending.transaction.transactionId
    || worldEvent.worldId !== graph.worldId
    || worldEvent.kind !== "world.transaction"
    || worldEvent.actorSubjectId !== pending.preview.actorSubjectId
    || worldEvent.priorWorldHead !== graph.receizWorldHead
    || worldEvent.registryDigest !== pending.transaction.registryDigest
    || worldEvent.reducerDigest !== pending.transaction.reducerDigest
    || JSON.stringify([...worldEvent.participantSubjectIds].sort()) !== JSON.stringify(participants)
    || canonicalPortableCardJson(worldEvent.priorHeads) !== canonicalPortableCardJson(pending.transaction.expectedHeads)
    || !exactKeys(worldEvent.nextHeads, participants)
    || canonicalPortableCardJson(worldEvent.causalParents) !== canonicalPortableCardJson(causalParents)
    || !/^\d+$/.test(worldEvent.kai)
    || canonicalPortableCardJson(worldEvent.payload) !== canonicalPortableCardJson(transactionEventPayload(pending.commandPlans))) return null;
  const graphHead = digest({
    schema: "wildz.excavation.graph.append.v1",
    priorGraphHead: graph.head,
    candidateEventDigest: pending.preview.candidateEventDigest,
    receizEventId: worldEvent.eventId,
    receizWorldHead: worldEvent.worldHead,
    reducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST
  });
  return immutable({
    schema: "wildz.excavation.event.v1" as const,
    eventId: worldEvent.eventId,
    commandId: worldEvent.commandId,
    worldId: worldEvent.worldId,
    priorGraphHead: graph.head,
    graphHead,
    receizPriorWorldHead: worldEvent.priorWorldHead,
    receizWorldHead: worldEvent.worldHead,
    idempotencyKey: pending.preview.idempotencyKey,
    candidateEventDigest: pending.preview.candidateEventDigest,
    preview: pending.preview,
    registryDigest: WILDS_EXCAVATION_REGISTRY_DIGEST,
    reducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST
  });
}
