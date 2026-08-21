import type { ReceizWorldEventV1 } from "@receiz/sdk";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import {
  WILDS_EXCAVATION_REDUCER_DIGEST,
  WILDS_EXCAVATION_REGISTRY_DIGEST,
  type WildsExcavationPhysicalEvidence,
  type WildsExcavationViewerAccess
} from "./wilds-excavation";
import type { WildsDiscoveryPhysicalNeighborhood } from "./wilds-discovery-sites";

// Pure, non-production foundation. Playable authored overlays remain gated
// until the v122 remote-subject, checkpoint-verification, encrypted-envelope,
// durable incremental store, and authored restore contracts documented in
// docs/receiz-decisions/2026-08-21-wilds-authored-world-authority.md exist.

type Point3 = Readonly<{ x: number; y: number; z: number }>;
type AccessMode = "public" | "invited" | "private";

export type WildsAuthoredSegment = Readonly<{
  kind: "segment";
  featureId: string;
  siteKey: string;
  ownerSubjectId: string;
  stewardSubjectId: string;
  from: Point3;
  to: Point3;
  radius: number;
  flooded: boolean;
  access: Readonly<{ mode: AccessMode; grantsDigest: string }>;
  sourceEventId: string;
}>;

export type WildsAuthoredChamber = Readonly<{
  kind: "chamber";
  featureId: string;
  parentFeatureId: string;
  siteKey: string;
  ownerSubjectId: string;
  stewardSubjectId: string;
  center: Point3;
  radius: number;
  flooded: boolean;
  access: Readonly<{ mode: AccessMode; grantsDigest: string }>;
  sourceEventId: string;
}>;

export type WildsAuthoredFeature = WildsAuthoredSegment | WildsAuthoredChamber;

export type WildsAuthoredWorldGraph = Readonly<{
  schema: "wildz.authored-world.graph.v1";
  worldId: string;
  worldHead: string;
  graphHead: string;
  registryDigest: string | null;
  reducerDigest: string | null;
  eventIds: readonly string[];
  eventDigests: readonly string[];
  idempotencyKeys: readonly string[];
  features: readonly WildsAuthoredFeature[];
}>;

export type WildsAuthoredWorldCheckpoint = Readonly<{
  schema: "wildz.authored-world.checkpoint.v1";
  revision: number;
  graph: WildsAuthoredWorldGraph;
}>;

export type WildsAuthoredMutation =
  | Readonly<{
    schema: "wildz.authored-world.mutation.v1";
    kind: "append-chamber";
    eventId: string;
    idempotencyKey: string;
    priorGraphHead: string;
    actorSubjectId: string;
    participantSubjectIds: readonly string[];
    parentFeatureId: string;
    center: Point3;
    radius: number;
    flooded: boolean;
  }>
  | Readonly<{
    schema: "wildz.authored-world.mutation.v1";
    kind: "access-policy";
    eventId: string;
    idempotencyKey: string;
    priorGraphHead: string;
    actorSubjectId: string;
    participantSubjectIds: readonly string[];
    featureId: string;
    access: Readonly<{ mode: AccessMode; grantsDigest: string }>;
  }>
  | Readonly<{
    schema: "wildz.authored-world.mutation.v1";
    kind: "stewardship-transfer";
    eventId: string;
    idempotencyKey: string;
    priorGraphHead: string;
    actorSubjectId: string;
    participantSubjectIds: readonly string[];
    featureId: string;
    recipientSubjectId: string;
    accepted: true;
  }>;

export type WildsAuthoredWorldStore = Readonly<{
  read(worldId: string): Promise<WildsAuthoredWorldCheckpoint | null>;
  compareAndSwap(worldId: string, expectedRevision: number, next: WildsAuthoredWorldCheckpoint): Promise<boolean>;
}>;

export type WildsAuthoredWorldRail = Readonly<{
  additions(input: { worldId: string; afterHead?: string }): Promise<readonly ReceizWorldEventV1[]>;
  replay(input: { worldId: string; throughHead?: string }): Promise<Readonly<{
    schema: "receiz.world.checkpoint.v1";
    worldId: string;
    throughHead: string;
    subjectHeads: Readonly<Record<string, string>>;
    events: readonly ReceizWorldEventV1[];
  }>>;
}>;

type SegmentAuthority = Readonly<{
  schema: "wildz.excavation.authority_event.v1";
  worldId: string;
  siteKey: string;
  actorSubjectId: string;
  creatureSubjectId: string;
  capability: Readonly<{ identityDigest: string; conditionDigest: string; families: readonly string[] }>;
  substrate: "soil" | "rock";
  geometry: Readonly<{ from: Point3; to: Point3; radius: number; surfaceExit: boolean; rescueRoute: boolean; flooded: boolean }>;
  safety: Readonly<{
    protectedVolumes: readonly Readonly<{ id: string; center: Point3; halfExtents: Point3 }>[];
    canonicalRoutes: readonly Readonly<{ id: string; points: readonly Point3[] }>[];
    rescueAnchor: Point3;
  }>;
  safetyDigest: string;
  physicalAuthority: WildsExcavationPhysicalEvidence;
  access: Readonly<{ mode: "public"; grantsDigest: string }>;
  creationKai: string;
  priorGraphHead: string;
}>;

type SegmentEnvelope = SegmentAuthority & Readonly<{
  previewDigest: string;
  idempotencyKey: string;
  candidateEventDigest: string;
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

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

export function emptyWildsAuthoredWorldGraph(worldId: string, worldHead = "receiz.world.genesis"): WildsAuthoredWorldGraph {
  return freeze({
    schema: "wildz.authored-world.graph.v1",
    worldId,
    worldHead,
    graphHead: digest({ schema: "wildz.excavation.graph.genesis.v1", worldId, receizWorldHead: worldHead, reducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST }),
    registryDigest: null,
    reducerDigest: null,
    eventIds: [],
    eventDigests: [],
    idempotencyKeys: [],
    features: []
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function finitePoint(value: unknown): value is Point3 {
  const point = record(value);
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
}

function noPrivateFields(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(noPrivateFields);
  const object = record(value);
  if (!object) return true;
  const forbidden = new Set(["creator", "creature", "proofDigest", "proofObjectId", "publicName", "publicAlias", "invitedSubjectIds", "grants"]);
  return Object.entries(object).every(([key, entry]) => !forbidden.has(key) && noPrivateFields(entry));
}

function parseSegmentEnvelope(event: ReceizWorldEventV1): SegmentEnvelope | null {
  const payload = record(event.payload);
  const commands = Array.isArray(payload?.commands) ? payload.commands : [];
  const command = commands.map(record).find((candidate) => candidate?.kind === "wildz.excavation.append.v1");
  const commandPayload = record(command?.payload);
  const preview = record(commandPayload?.preview);
  if (!command || !commandPayload || !preview || !noPrivateFields(commandPayload)) return null;
  const geometry = record(preview.geometry);
  const safety = record(preview.safety);
  const physicalAuthority = record(preview.physicalAuthority);
  const capability = record(preview.capability);
  const access = record(preview.access);
  if (preview.schema !== "wildz.excavation.preview.v1"
    || commandPayload.schema !== "wildz.excavation.command_payload.v1"
    || commandPayload.domainRegistryDigest !== WILDS_EXCAVATION_REGISTRY_DIGEST
    || commandPayload.domainReducerDigest !== WILDS_EXCAVATION_REDUCER_DIGEST
    || typeof preview.worldId !== "string" || preview.worldId !== event.worldId
    || typeof preview.siteKey !== "string"
    || typeof preview.actorSubjectId !== "string" || preview.actorSubjectId !== event.actorSubjectId
    || typeof preview.creatureSubjectId !== "string"
    || !event.participantSubjectIds.includes(preview.creatureSubjectId)
    || !capability || !Array.isArray(capability.families)
    || !geometry || !finitePoint(geometry.from) || !finitePoint(geometry.to) || !Number.isFinite(geometry.radius)
    || !safety || !Array.isArray(safety.protectedVolumes) || !Array.isArray(safety.canonicalRoutes) || !finitePoint(safety.rescueAnchor)
    || !physicalAuthority || !access || access.mode !== "public"
    || typeof preview.creationKai !== "string" || !/^\d+$/.test(preview.creationKai)
    || typeof preview.priorGraphHead !== "string" || typeof preview.idempotencyKey !== "string"
    || typeof preview.candidateEventDigest !== "string" || typeof preview.previewDigest !== "string") return null;
  const authority = {
    schema: "wildz.excavation.authority_event.v1" as const,
    worldId: preview.worldId,
    siteKey: preview.siteKey,
    actorSubjectId: preview.actorSubjectId,
    creatureSubjectId: preview.creatureSubjectId,
    capability,
    substrate: preview.substrate,
    geometry,
    safety,
    safetyDigest: preview.safetyDigest,
    physicalAuthority,
    access,
    creationKai: preview.creationKai,
    priorGraphHead: preview.priorGraphHead
  } as unknown as SegmentAuthority;
  const candidateEventDigest = digest({ ...authority, domainRegistryDigest: WILDS_EXCAVATION_REGISTRY_DIGEST, domainReducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST });
  const idempotencyKey = `wildz.excavation.v1:${digest({ authorityBasis: authority, candidateEventDigest }).slice(-32)}`;
  if (candidateEventDigest !== preview.candidateEventDigest || idempotencyKey !== preview.idempotencyKey
    || commandPayload.candidateEventDigest !== candidateEventDigest || commandPayload.priorGraphHead !== authority.priorGraphHead) return null;
  return freeze({ ...authority, previewDigest: preview.previewDigest, idempotencyKey, candidateEventDigest });
}

function appendSegment(graph: WildsAuthoredWorldGraph, event: ReceizWorldEventV1, envelope: SegmentEnvelope) {
  if (graph.idempotencyKeys.includes(envelope.idempotencyKey)) return graph;
  if (envelope.priorGraphHead !== graph.graphHead || event.priorWorldHead !== graph.worldHead) throw new Error("wilds_authored_chain_gap");
  if (graph.eventIds.includes(event.eventId)) throw new Error("wilds_authored_event_conflict");
  const graphHead = digest({
    schema: "wildz.excavation.graph.append.v1",
    priorGraphHead: graph.graphHead,
    candidateEventDigest: envelope.candidateEventDigest,
    receizEventId: event.eventId,
    receizWorldHead: event.worldHead,
    reducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST
  });
  const feature: WildsAuthoredSegment = freeze({
    kind: "segment",
    featureId: `wildz.excavation.segment.v1:${envelope.candidateEventDigest.slice(-24)}`,
    siteKey: envelope.siteKey,
    ownerSubjectId: envelope.actorSubjectId,
    stewardSubjectId: envelope.actorSubjectId,
    from: envelope.geometry.from,
    to: envelope.geometry.to,
    radius: envelope.geometry.radius,
    flooded: envelope.geometry.flooded,
    access: envelope.access,
    sourceEventId: event.eventId
  });
  return freeze({
    ...graph,
    worldHead: event.worldHead,
    graphHead,
    registryDigest: event.registryDigest,
    reducerDigest: event.reducerDigest,
    eventIds: [...graph.eventIds, event.eventId],
    eventDigests: [...graph.eventDigests, digest(event)],
    idempotencyKeys: [...graph.idempotencyKeys, envelope.idempotencyKey],
    features: [...graph.features, feature]
  });
}

async function reduceEvents(
  base: WildsAuthoredWorldGraph,
  events: readonly ReceizWorldEventV1[],
  resolveEvidence: (event: SegmentEnvelope) => Promise<WildsExcavationPhysicalEvidence>
) {
  let graph = base;
  for (const event of events) {
    const priorIndex = graph.eventIds.indexOf(event.eventId);
    if (priorIndex >= 0) {
      if (graph.eventDigests[priorIndex] !== digest(event)) throw new Error("wilds_authored_event_conflict");
      continue;
    }
    if (event.schema !== "receiz.world.event.v1" || event.worldId !== graph.worldId
      || event.kind !== "world.transaction" || event.priorWorldHead !== graph.worldHead
      || event.causalParents[0] !== event.priorWorldHead
      || (graph.registryDigest !== null && event.registryDigest !== graph.registryDigest)
      || (graph.reducerDigest !== null && event.reducerDigest !== graph.reducerDigest)) throw new Error("wilds_authored_receiz_chain_invalid");
    const envelope = parseSegmentEnvelope(event);
    if (!envelope) throw new Error("wilds_authored_event_invalid");
    const evidence = await resolveEvidence(envelope);
    if (canonicalPortableCardJson(evidence) !== canonicalPortableCardJson(envelope.physicalAuthority)) {
      throw new Error("wilds_authored_physical_evidence_invalid");
    }
    graph = appendSegment(graph, event, envelope);
  }
  return graph;
}

export async function hydrateWildsAuthoredWorld(input: Readonly<{
  worldId: string;
  rail: WildsAuthoredWorldRail;
  store: WildsAuthoredWorldStore;
  resolveEvidence: (event: SegmentEnvelope) => Promise<WildsExcavationPhysicalEvidence>;
}>) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const stored = await input.store.read(input.worldId);
    const base = stored?.graph ?? emptyWildsAuthoredWorldGraph(input.worldId);
    let events = await input.rail.additions({ worldId: input.worldId, afterHead: base.worldHead });
    let reduceBase = base;
    if (events.length > 0 && events[0]!.priorWorldHead !== base.worldHead) {
      const replay = await input.rail.replay({ worldId: input.worldId });
      if (replay.schema !== "receiz.world.checkpoint.v1" || replay.worldId !== input.worldId) throw new Error("wilds_authored_replay_invalid");
      reduceBase = emptyWildsAuthoredWorldGraph(input.worldId);
      events = replay.events;
    }
    if (events.length === 0) return base;
    const graph = await reduceEvents(reduceBase, events, input.resolveEvidence);
    const next = freeze({ schema: "wildz.authored-world.checkpoint.v1" as const, revision: (stored?.revision ?? 0) + 1, graph });
    if (await input.store.compareAndSwap(input.worldId, stored?.revision ?? 0, next)) return graph;
  }
  throw new Error("wilds_authored_checkpoint_conflict");
}

function mutationParticipantsValid(actual: readonly string[], expected: readonly string[]) {
  const sorted = [...new Set(actual)].sort();
  return canonicalPortableCardJson(sorted) === canonicalPortableCardJson([...expected].sort());
}

export function appendWildsAuthoredMutation(graph: WildsAuthoredWorldGraph, mutation: WildsAuthoredMutation) {
  if (mutation.schema !== "wildz.authored-world.mutation.v1" || mutation.priorGraphHead !== graph.graphHead) {
    throw new Error("wilds_authored_mutation_stale");
  }
  if (!mutation.idempotencyKey || !mutation.eventId) throw new Error("wilds_authored_mutation_invalid");
  if (graph.idempotencyKeys.includes(mutation.idempotencyKey)) return graph;
  if (graph.eventIds.includes(mutation.eventId)) throw new Error("wilds_authored_event_conflict");
  let features: readonly WildsAuthoredFeature[];
  if (mutation.kind === "append-chamber") {
    const parent = graph.features.find((feature) => feature.featureId === mutation.parentFeatureId);
    if (!parent || parent.stewardSubjectId !== mutation.actorSubjectId
      || !mutationParticipantsValid(mutation.participantSubjectIds, [mutation.actorSubjectId])
      || !finitePoint(mutation.center) || !Number.isFinite(mutation.radius) || mutation.radius < 2 || mutation.radius > 12) {
      throw new Error("wilds_authored_chamber_authority_invalid");
    }
    const anchor = parent.kind === "segment" ? parent.to : parent.center;
    if (Math.hypot(anchor.x - mutation.center.x, anchor.y - mutation.center.y, anchor.z - mutation.center.z) > parent.radius + mutation.radius + 2) {
      throw new Error("wilds_authored_chamber_disconnected");
    }
    const chamber: WildsAuthoredChamber = freeze({
      kind: "chamber",
      featureId: `wildz.excavation.chamber.v1:${digest(mutation).slice(-24)}`,
      parentFeatureId: parent.featureId,
      siteKey: parent.siteKey,
      ownerSubjectId: parent.ownerSubjectId,
      stewardSubjectId: parent.stewardSubjectId,
      center: mutation.center,
      radius: mutation.radius,
      flooded: mutation.flooded,
      access: parent.access,
      sourceEventId: mutation.eventId
    });
    features = [...graph.features, chamber];
  } else {
    const index = graph.features.findIndex((feature) => feature.featureId === mutation.featureId);
    const current = graph.features[index];
    if (!current || current.stewardSubjectId !== mutation.actorSubjectId) throw new Error("wilds_authored_steward_authority_invalid");
    if (mutation.kind === "access-policy") {
      if (!mutationParticipantsValid(mutation.participantSubjectIds, [mutation.actorSubjectId])
        || !mutation.access.grantsDigest || (mutation.access.mode === "public" && mutation.access.grantsDigest.includes("invite"))) {
        throw new Error("wilds_authored_access_policy_invalid");
      }
      features = graph.features.map((feature) => feature.featureId === mutation.featureId ? freeze({ ...feature, access: mutation.access }) : feature);
    } else {
      if (!mutation.accepted || mutation.recipientSubjectId === mutation.actorSubjectId
        || !mutationParticipantsValid(mutation.participantSubjectIds, [mutation.actorSubjectId, mutation.recipientSubjectId])) {
        throw new Error("wilds_authored_steward_transfer_invalid");
      }
      features = graph.features.map((feature) => feature.featureId === mutation.featureId
        ? freeze({ ...feature, stewardSubjectId: mutation.recipientSubjectId }) : feature);
    }
  }
  const graphHead = digest({ schema: "wildz.authored-world.graph.append.v1", priorGraphHead: graph.graphHead, mutation });
  return freeze({
    ...graph,
    graphHead,
    eventIds: [...graph.eventIds, mutation.eventId],
    eventDigests: [...graph.eventDigests, digest(mutation)],
    idempotencyKeys: [...graph.idempotencyKeys, mutation.idempotencyKey],
    features
  });
}

const composedCache = new WeakMap<WildsDiscoveryPhysicalNeighborhood, WeakMap<WildsAuthoredWorldGraph, WeakMap<WildsExcavationViewerAccess, WildsDiscoveryPhysicalNeighborhood>>>();
let composedBuilds = 0;

function accessAllowed(feature: WildsAuthoredFeature, viewer: WildsExcavationViewerAccess) {
  if (feature.access.mode === "public" || viewer.actorSubjectId === feature.ownerSubjectId || viewer.actorSubjectId === feature.stewardSubjectId) return true;
  const grant = viewer.grants.get(feature.access.grantsDigest);
  return feature.access.mode === "invited" && grant?.actorSubjectId === viewer.actorSubjectId && grant.admitted && !grant.revoked;
}

function samplesForSegment(segment: WildsAuthoredSegment) {
  const length = Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y, segment.to.z - segment.from.z);
  const count = Math.max(1, Math.ceil(length / Math.max(1, segment.radius * 1.4)));
  return Array.from({ length: count + 1 }, (_, index) => {
    const amount = index / count;
    return freeze({
      x: segment.from.x + (segment.to.x - segment.from.x) * amount,
      y: segment.from.y + (segment.to.y - segment.from.y) * amount,
      z: segment.from.z + (segment.to.z - segment.from.z) * amount
    });
  });
}

export function composeWildsAuthoredPhysicalNeighborhood(
  natural: WildsDiscoveryPhysicalNeighborhood,
  graph: WildsAuthoredWorldGraph,
  viewer: WildsExcavationViewerAccess
) {
  let graphCache = composedCache.get(natural);
  let viewerCache = graphCache?.get(graph);
  const cached = viewerCache?.get(viewer);
  if (cached) return cached;
  const visible = graph.features.filter((feature) => accessAllowed(feature, viewer));
  const surfaces = [...natural.surfaces];
  const ceilings = [...natural.ceilings];
  const portals = [...natural.portals];
  const waterVolumes = [...natural.waterVolumes];
  const encounterVolumes = [...natural.encounterVolumes];
  for (const feature of visible) {
    if (feature.kind === "chamber") {
      const spaceId = `wildz.authored.space.v1:${feature.parentFeatureId}`;
      const halfExtents = freeze({ x: feature.radius, y: .3, z: feature.radius });
      surfaces.push(freeze({ id: `${feature.featureId}:floor`, siteKey: feature.siteKey, spaceId, kind: "interior-floor" as const, center: feature.center, halfExtents, flooded: feature.flooded }));
      ceilings.push(freeze({ id: `${feature.featureId}:ceiling`, siteKey: feature.siteKey, spaceId, center: freeze({ ...feature.center, y: feature.center.y + feature.radius * 1.8 }), halfExtents }));
      encounterVolumes.push(freeze({ id: `${feature.featureId}:encounter`, siteKey: feature.siteKey, spaceId, layer: feature.flooded ? "water-column" as const : "ground" as const, center: feature.center, halfExtents: freeze({ x: feature.radius, y: feature.radius, z: feature.radius }) }));
      if (feature.flooded) waterVolumes.push(freeze({
        id: `${feature.featureId}:water`, siteKey: feature.siteKey, spaceId, kind: "flooded-interior" as const,
        center: feature.center, halfExtents: freeze({ x: feature.radius, y: feature.radius, z: feature.radius }),
        source: feature.center, lip: feature.center, flowPath: [feature.center], pool: feature.center, current: 0
      }));
      continue;
    }
    const spaceId = `wildz.authored.space.v1:${feature.featureId}`;
    const samples = samplesForSegment(feature);
    samples.forEach((center, index) => {
      const id = `${feature.featureId}:cell:${index}`;
      const halfExtents = freeze({ x: feature.radius, y: .3, z: feature.radius });
      surfaces.push(freeze({ id: `${id}:floor`, siteKey: feature.siteKey, spaceId, kind: "interior-floor" as const, center, halfExtents, flooded: feature.flooded }));
      ceilings.push(freeze({ id: `${id}:ceiling`, siteKey: feature.siteKey, spaceId, center: freeze({ ...center, y: center.y + feature.radius * 1.8 }), halfExtents }));
      encounterVolumes.push(freeze({ id: `${id}:encounter`, siteKey: feature.siteKey, spaceId, layer: feature.flooded ? "water-column" as const : "ground" as const, center, halfExtents: freeze({ x: feature.radius, y: feature.radius, z: feature.radius }) }));
      if (feature.flooded) waterVolumes.push(freeze({
        id: `${id}:water`, siteKey: feature.siteKey, spaceId, kind: "flooded-interior" as const,
        center, halfExtents: freeze({ x: feature.radius, y: feature.radius, z: feature.radius }),
        source: feature.from, lip: feature.from, flowPath: [feature.from, feature.to], pool: feature.to, current: 0
      }));
    });
    if (feature.from) portals.push(freeze({
      id: `${feature.featureId}:portal`, siteKey: feature.siteKey, position: feature.from,
      fromSpaceId: "wildz.space.outer.v1" as const, toSpaceId: spaceId
    }));
  }
  const composed = freeze({ ...natural, surfaces, ceilings, portals, waterVolumes, encounterVolumes });
  composedBuilds += 1;
  if (!graphCache) { graphCache = new WeakMap(); composedCache.set(natural, graphCache); }
  if (!viewerCache) { viewerCache = new WeakMap(); graphCache.set(graph, viewerCache); }
  viewerCache.set(viewer, composed);
  return composed;
}

export function wildsAuthoredWorldDiagnostics() {
  return freeze({ composedBuilds });
}

export type WildsAuthoredPublicSnapshot = Readonly<{
  schema: "wildz.authored-world.public-snapshot.v1";
  worldId: string;
  worldHead: string;
  graphHead: string;
  features: readonly Readonly<{
    kind: "segment" | "chamber";
    featureId: string;
    siteKey: string;
    parentFeatureId?: string;
    from?: Point3;
    to?: Point3;
    center?: Point3;
    radius: number;
    flooded: boolean;
    access: "public";
  }>[];
}>;

export function projectWildsAuthoredPublicSnapshot(graph: WildsAuthoredWorldGraph): WildsAuthoredPublicSnapshot {
  return freeze({
    schema: "wildz.authored-world.public-snapshot.v1",
    worldId: graph.worldId,
    worldHead: graph.worldHead,
    graphHead: graph.graphHead,
    features: graph.features.filter((feature) => feature.access.mode === "public").map((feature) => feature.kind === "segment" ? {
      kind: "segment" as const,
      featureId: feature.featureId,
      siteKey: feature.siteKey,
      from: feature.from,
      to: feature.to,
      radius: feature.radius,
      flooded: feature.flooded,
      access: "public" as const
    } : {
      kind: "chamber" as const,
      featureId: feature.featureId,
      parentFeatureId: feature.parentFeatureId,
      siteKey: feature.siteKey,
      center: feature.center,
      radius: feature.radius,
      flooded: feature.flooded,
      access: "public" as const
    })
  });
}

export function graphFromWildsAuthoredPublicSnapshots(snapshots: readonly WildsAuthoredPublicSnapshot[]) {
  const features: WildsAuthoredFeature[] = snapshots.flatMap((snapshot) => snapshot.features.map((feature) => feature.kind === "segment" ? freeze({
    kind: "segment" as const,
    featureId: feature.featureId,
    siteKey: feature.siteKey,
    ownerSubjectId: "wildz.public.redacted",
    stewardSubjectId: "wildz.public.redacted",
    from: feature.from!,
    to: feature.to!,
    radius: feature.radius,
    flooded: feature.flooded,
    access: freeze({ mode: "public" as const, grantsDigest: "sha256:public" }),
    sourceEventId: "wildz.public.redacted"
  }) : freeze({
    kind: "chamber" as const,
    featureId: feature.featureId,
    parentFeatureId: feature.parentFeatureId!,
    siteKey: feature.siteKey,
    ownerSubjectId: "wildz.public.redacted",
    stewardSubjectId: "wildz.public.redacted",
    center: feature.center!,
    radius: feature.radius,
    flooded: feature.flooded,
    access: freeze({ mode: "public" as const, grantsDigest: "sha256:public" }),
    sourceEventId: "wildz.public.redacted"
  })));
  const basis = snapshots.map((snapshot) => ({ worldId: snapshot.worldId, worldHead: snapshot.worldHead, graphHead: snapshot.graphHead })).sort((left, right) => left.worldId.localeCompare(right.worldId));
  return freeze({
    schema: "wildz.authored-world.graph.v1" as const,
    worldId: "wildz.authored-world.neighborhood.v1",
    worldHead: digest(basis.map((entry) => entry.worldHead)),
    graphHead: digest(basis),
    registryDigest: null,
    reducerDigest: null,
    eventIds: [],
    eventDigests: [],
    idempotencyKeys: [],
    features
  });
}
