import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  ReceizClient,
  ReceizWorldCommandPlanV1,
  ReceizWorldCommandV1,
  ReceizWorldExecutionResultV1,
  ReceizWorldTransactionV1
} from "@receiz/sdk";
import { RECEIZ_LIVING_SUBJECT_REDUCER_DIGEST, RECEIZ_V120_REGISTRY_DIGEST, RECEIZ_V121_REGISTRY_DIGEST, createReceizLivingSubjectRuntime } from "@receiz/sdk";
import type {
  CreatureCapabilityIdentityV1,
  CreatureRuntimeCapabilities,
  CreatureSpecialtyFamily
} from "../src/features/play/creature-capability-identity";
import {
  emptyWildsExcavationGraph,
  executeWildsExcavationAdmission,
  previewWildsExcavation,
  compileWildsExcavationAccess,
  compileWildsExcavationViewerAccess,
  deriveWildsExcavationPhysicalAuthority,
  digestWildsExcavationCapabilityIdentity,
  digestWildsExcavationSafetyAuthority,
  projectWildsExcavationMakerMark,
  projectWildsExcavationPublicFeatureRefs,
  projectWildsExcavationPhysicalGraph,
  recoverWildsExcavationAdmission,
  replayWildsExcavationEvents,
  wildsExcavationDiagnostics,
  type WildsExcavationAdmissionJournal,
  type WildsExcavationPendingAdmission,
  wildsExcavationWorldIdForSite,
  WILDS_EXCAVATION_REDUCER_DIGEST,
  WILDS_EXCAVATION_REGISTRY_DIGEST,
  type WildsExcavationReceizPort
} from "../src/features/play/wilds-excavation";
import { admitWildsDiscoveryPhysicalNeighborhood, wildsDiscoverySitesForRegion } from "../src/features/play/wilds-discovery-sites";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import { createPersistentWildsExcavationJournal } from "../src/features/play/wilds-excavation-journal";
import type { WildzContinuityDatabase, WildzContinuityTransaction, WildzStoreName } from "../src/lib/storage/wildz-indexed-db";
import {
  composeWildsAuthoredPhysicalNeighborhood,
  appendWildsAuthoredMutation,
  emptyWildsAuthoredWorldGraph,
  hydrateWildsAuthoredWorld,
  wildsAuthoredWorldDiagnostics,
  type WildsAuthoredWorldCheckpoint,
  type WildsAuthoredWorldStore
} from "../src/features/play/wilds-authored-world";

const SITE_KEY = wildsDiscoverySitesForRegion(0, 0)[0]!.key;
const WORLD_ID = wildsExcavationWorldIdForSite(SITE_KEY);
const BASE_FROM = { x: 10, y: sampleWildsTerrain(10, 12).elevation, z: 12 };
const BASE_TO = { x: 18, y: sampleWildsTerrain(18, 14).elevation, z: 14 };
const WATER_POINT = (() => {
  for (let z = -512; z <= 512; z += 4) for (let x = -512; x <= 512; x += 4) {
    const terrain = sampleWildsTerrain(x, z);
    const next = sampleWildsTerrain(x + 2.1, z);
    if (terrain.surface === "deep-water" && next.surface === "deep-water") return { x, z, y: terrain.elevation + .5, nextY: next.elevation + .5 };
  }
  throw new Error("wilds_excavation_water_fixture_missing");
})();
const WATER_REGION = { x: Math.floor(WATER_POINT.x / 128), z: Math.floor(WATER_POINT.z / 128) };
const WATER_SITE_KEY = wildsDiscoverySitesForRegion(WATER_REGION.x, WATER_REGION.z)[0]!.key;
const WATER_WORLD_ID = wildsExcavationWorldIdForSite(WATER_SITE_KEY);
const EXPLORER_IDENTITY_DIGEST = "a".repeat(64);
const CREATURE_IDENTITY_DIGEST = "b".repeat(64);
const REVISION_DIGEST = "c".repeat(64);

function capabilityEvidence(families: readonly CreatureSpecialtyFamily[]) {
  const specialties = families.map((family, index) => ({
    id: `${family}:${index}`,
    family,
    potential: 90,
    control: 90,
    endurance: 90
  }));
  const abilities = specialties.map((specialty) => ({
    id: `ability:${specialty.id}`,
    name: specialty.family,
    action: specialty.family,
    tags: [specialty.family],
    powerCurve: [90],
    unlockLevel: 1
  }));
  const identity: CreatureCapabilityIdentityV1 = {
    schema: "receiz.wilds.creature_capability_identity.v1",
    assetId: "creature:borer",
    digestInput: { proofDigest: `sha256:${CREATURE_IDENTITY_DIGEST}`, revisionDigest: `sha256:${REVISION_DIGEST}`, visualFingerprint: "borer" },
    traversalPotential: families.includes("swim") ? ["swim"] : [],
    specialties,
    abilities,
    progression: { level: 8, bond: 80, mastery: 80 }
  };
  const runtime: CreatureRuntimeCapabilities = {
    assetId: identity.assetId,
    capabilities: identity.traversalPotential,
    abilities: abilities.map((descriptor) => ({ descriptor, currentPower: 90, available: true })),
    level: 8,
    bond: 80,
    mastery: 80,
    suppressed: []
  };
  return { identity, runtime, conditionDigest: "sha256:healthy" };
}

function previewInput(overrides: Record<string, unknown> = {}) {
  return {
    worldId: WORLD_ID,
    siteKey: SITE_KEY,
    actorSubjectId: "explorer:one",
    creatureSubjectId: "creature:borer",
    creator: { proofDigest: `sha256:${EXPLORER_IDENTITY_DIGEST}`, proofObjectId: "proof:explorer", publicAlias: "River", public: true },
    creature: { proofDigest: `sha256:${CREATURE_IDENTITY_DIGEST}`, proofObjectId: "proof:creature", publicName: "Stonewing" },
    capability: capabilityEvidence(["burrow", "break"]),
    substrate: "soil" as const,
    geometry: {
      from: BASE_FROM,
      to: BASE_TO,
      radius: 1.4,
      surfaceExit: true,
      rescueRoute: true,
      flooded: false
    },
    safety: { protectedVolumes: [], canonicalRoutes: [], rescueAnchor: BASE_FROM },
    physicalAuthority: { projectionDigest: "sha256:physical-projection-v1", spaceId: "wildz.space.outer.v1" },
    access: { mode: "public" as const, invitedSubjectIds: [] },
    creationKai: "123456",
    priorGraphHead: "sha256:graph-genesis",
    ...overrides
  };
}

type RailCalls = { plan: number; validate: number; transaction: number; execute: number; resolve: number };

function memoryJournal(): WildsExcavationAdmissionJournal {
  const values = new Map<string, WildsExcavationPendingAdmission>();
  const key = (worldId: string, idempotencyKey: string) => `${worldId}:${idempotencyKey}`;
  return {
    read: async (worldId, idempotencyKey) => values.get(key(worldId, idempotencyKey)) ?? null,
    stage: async (entry) => { values.set(key(entry.preview.worldId, entry.preview.idempotencyKey), entry); },
    remove: async (worldId, idempotencyKey) => { values.delete(key(worldId, idempotencyKey)); }
  };
}

function fakeContinuityDatabase(): WildzContinuityDatabase {
  const values = new Map<IDBValidKey, unknown>();
  const transaction: WildzContinuityTransaction = {
    get: async <T>(_store: string, key: IDBValidKey) => (values.get(key) as T | undefined) ?? null,
    getAll: async <T>() => [...values.values()] as T[],
    put: async <T>(_store: string, value: T, key?: IDBValidKey) => { if (key !== undefined) values.set(key, value); },
    delete: async (_store: string, key: IDBValidKey) => { values.delete(key); }
  };
  return {
    read: async <T>(_store: WildzStoreName, key: IDBValidKey) => (values.get(key) as T | undefined) ?? null,
    transaction: async (_stores, _mode, operation) => operation(transaction)
  };
}

function successfulRail(options: { fail?: ReceizWorldExecutionResultV1; eventPayload?: Readonly<Record<string, unknown>> } = {}) {
  const calls: RailCalls = { plan: 0, validate: 0, transaction: 0, execute: 0, resolve: 0 };
  let input: Parameters<ReceizClient["world"]["planCommand"]>[0] | null = null;
  const inputs: Parameters<ReceizClient["world"]["planCommand"]>[0][] = [];
  const rail: WildsExcavationReceizPort = {
    async resolvePhysicalEvidence(preview) { return preview.physicalAuthority; },
    async resolveSubject(subjectId) {
      calls.resolve += 1;
      return {
        subjectId, head: `${subjectId}:head`, registryDigest: "sdk-registry", reducerDigest: "sdk-reducer",
        proofObjectId: subjectId === "explorer:one" ? "proof:explorer" : "proof:creature",
        identityDigest: subjectId === "explorer:one" ? EXPLORER_IDENTITY_DIGEST : CREATURE_IDENTITY_DIGEST,
        currentOwnerReceizId: "receiz:one",
        capabilityIdentityDigest: subjectId === "creature:borer" ? digestWildsExcavationCapabilityIdentity(capabilityEvidence(["burrow", "break"]).identity) : null,
        conditionDigest: subjectId === "creature:borer" ? "sha256:healthy" : null
      };
    },
    async planCommand(value) {
      calls.plan += 1;
      input = value;
      inputs.push(value);
      const command: ReceizWorldCommandV1 = {
        schema: "receiz.world.command.v1",
        commandId: `command:${calls.plan}`,
        commandDigest: `command-digest:${calls.plan}`,
        input: value
      };
      return {
        schema: "receiz.world.command_plan.v1",
        planId: command.commandId,
        planDigest: `plan-digest:${calls.plan}`,
        command,
        priorHeads: value.expectedHeads,
        worldHead: value.expectedWorldHead,
        registryDigest: "sdk-registry",
        reducerDigest: "sdk-reducer",
        writesOnFailure: 0
      } satisfies ReceizWorldCommandPlanV1;
    },
    async validateCommand(plan) {
      calls.validate += 1;
      return { ok: true, writes: 0, planDigest: plan.planDigest };
    },
    async planTransaction(value) {
      calls.transaction += 1;
      return {
        schema: "receiz.world.transaction.v1",
        transactionId: "transaction:one",
        transactionDigest: "transaction-digest",
        worldId: WORLD_ID,
        participants: value.participants,
        expectedHeads: value.expectedHeads,
        commands: value.commands,
        registryDigest: "sdk-registry",
        reducerDigest: "sdk-reducer"
      } satisfies ReceizWorldTransactionV1;
    },
    async executeTransaction(plan) {
      calls.execute += 1;
      if (options.fail) return options.fail;
      const command = plan.commands[0]!;
      return {
        ok: true,
        receipt: {
          schema: "receiz.world.receipt.v1",
          receiptId: "receipt:one",
          commandId: plan.transactionId,
          attemptId: command.input.attemptId,
          eventIds: ["event:one"],
          actorSubjectId: command.input.actorSubjectId,
          priorHeads: command.input.expectedHeads,
          nextHeads: { "creature:borer": "creature:next", "explorer:one": "explorer:next" },
          worldHead: "world:next",
          reducerDigest: plan.reducerDigest,
          registryDigest: plan.registryDigest,
          kai: "123457"
        },
        events: [{
          schema: "receiz.world.event.v1",
          eventId: "event:one",
          commandId: plan.transactionId,
          worldId: command.input.worldId,
          kind: "world.transaction",
          actorSubjectId: command.input.actorSubjectId,
          participantSubjectIds: plan.participants,
          payload: options.eventPayload ?? { commands: plan.commands.map((candidate) => candidate.input) },
          causalParents: [command.input.expectedWorldHead, ...Object.values(command.input.expectedHeads)],
          priorHeads: command.input.expectedHeads,
          nextHeads: { "creature:borer": "creature:next", "explorer:one": "explorer:next" },
          priorWorldHead: command.input.expectedWorldHead,
          worldHead: "world:next",
          kai: "123457",
          registryDigest: plan.registryDigest,
          reducerDigest: plan.reducerDigest
        }]
      };
    },
    async additions() { return []; }
  };
  return { rail, calls, plannedInput: () => input, plannedInputs: () => inputs };
}

describe("Receiz-backed player excavation", () => {
  it("keeps previews explicitly nonphysical and admits only structured healthy burrow capability", () => {
    const preview = previewWildsExcavation(previewInput());
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    assert.equal(preview.preview.schema, "wildz.excavation.preview.v1");
    assert.equal(preview.preview.physical, false);
    assert.deepEqual(projectWildsExcavationPhysicalGraph(emptyWildsExcavationGraph(WORLD_ID)), { segments: [], chambers: [] });

    const available = capabilityEvidence(["burrow"]);
    const unavailable = {
      ...available,
      runtime: { ...available.runtime, abilities: available.runtime.abilities.map((ability) => ({ ...ability, available: false })) }
    };
    const rejected = previewWildsExcavation(previewInput({ capability: unavailable }));
    assert.deepEqual(rejected, { ok: false, code: "capability_unavailable", writes: 0 });
  });

  it("requires a rock borer for hard rock and exact water support for submerged tunnels", () => {
    assert.deepEqual(
      previewWildsExcavation(previewInput({ substrate: "rock", capability: capabilityEvidence(["burrow"]) })),
      { ok: false, code: "rock_break_capability_required", writes: 0 }
    );
    const waterGeometry = {
      from: { x: WATER_POINT.x, y: WATER_POINT.y, z: WATER_POINT.z },
      to: { x: WATER_POINT.x + 2.1, y: WATER_POINT.nextY, z: WATER_POINT.z },
      radius: 1.2, surfaceExit: true, rescueRoute: true, flooded: true
    };
    const waterBasis = { worldId: WATER_WORLD_ID, siteKey: WATER_SITE_KEY, geometry: waterGeometry, safety: { protectedVolumes: [], canonicalRoutes: [], rescueAnchor: waterGeometry.from } };
    assert.deepEqual(
      previewWildsExcavation(previewInput({
        ...waterBasis,
        capability: capabilityEvidence(["burrow", "break", "swim"])
      })),
      { ok: false, code: "submerged_support_required", writes: 0 }
    );
    const submerged = previewWildsExcavation(previewInput({
      ...waterBasis,
      capability: capabilityEvidence(["burrow", "break", "swim", "dive", "current", "resist", "anchor"])
    }));
    assert.equal(submerged.ok, true);
  });

  it("derives rock, narrow water, space, and exits from the exact Phase-B physical projection", () => {
    let fixture: ReturnType<typeof admitWildsDiscoveryPhysicalNeighborhood> | null = null;
    let water: ReturnType<typeof admitWildsDiscoveryPhysicalNeighborhood>["waterVolumes"][number] | null = null;
    for (let regionZ = -4; regionZ <= 4 && !water; regionZ += 1) for (let regionX = -4; regionX <= 4 && !water; regionX += 1) {
      const physical = admitWildsDiscoveryPhysicalNeighborhood(regionX, regionZ);
      const candidate = physical.waterVolumes.find((volume) => volume.spaceId === "wildz.space.outer.v1"
        && physical.sites.some((site) => site.key === volume.siteKey));
      if (candidate) { fixture = physical; water = candidate; }
    }
    assert.ok(fixture && water);
    if (!fixture || !water) return;
    const geometry = {
      from: { x: water.center.x - Math.min(2, water.halfExtents.x), y: water.center.y, z: water.center.z },
      to: { x: water.center.x + Math.min(2, water.halfExtents.x), y: water.center.y, z: water.center.z },
      radius: .9, surfaceExit: false, rescueRoute: false, flooded: true
    };
    const authority = deriveWildsExcavationPhysicalAuthority(fixture, water.siteKey, geometry);
    assert.equal(authority.evidence.flooded, true);
    assert.equal(authority.evidence.spaceId, water.spaceId);
    assert.equal(authority.evidence.safetyDigest, digestWildsExcavationSafetyAuthority(authority.safety));
    const solid = fixture.solids.find((candidate) => candidate.siteKey === water.siteKey);
    if (solid) {
      const rockGeometry = { ...geometry, from: solid.center, to: { ...solid.center, x: solid.center.x + 2 } };
      assert.equal(deriveWildsExcavationPhysicalAuthority(fixture, water.siteKey, rockGeometry).evidence.substrate, "rock");
    }
  });

  it("refuses cross-region, protected-volume, canonical-route, and unreachable-rescue excavation", () => {
    assert.deepEqual(previewWildsExcavation(previewInput({
      geometry: { ...previewInput().geometry, to: { x: 130, y: 1, z: 14 } }
    })), { ok: false, code: "cross_region_geometry_forbidden", writes: 0 });
    assert.deepEqual(previewWildsExcavation(previewInput({
      safety: {
        ...previewInput().safety,
        protectedVolumes: [{ id: "hearttree", center: { x: 14, y: (BASE_FROM.y + BASE_TO.y) / 2, z: 13 }, halfExtents: { x: 1, y: 2, z: 1 } }]
      }
    })), { ok: false, code: "protected_volume_conflict", writes: 0 });
    assert.deepEqual(previewWildsExcavation(previewInput({
      safety: {
        ...previewInput().safety,
        canonicalRoutes: [{ id: "safe-route", points: [{ x: 14, y: (BASE_FROM.y + BASE_TO.y) / 2, z: 13 }] }]
      }
    })), { ok: false, code: "canonical_route_conflict", writes: 0 });
    assert.deepEqual(previewWildsExcavation(previewInput({
      safety: {
        ...previewInput().safety,
        canonicalRoutes: [{ id: "sparse-crossing", points: [{ x: 14, y: (BASE_FROM.y + BASE_TO.y) / 2, z: 0 }, { x: 14, y: (BASE_FROM.y + BASE_TO.y) / 2, z: 30 }] }]
      }
    })), { ok: false, code: "canonical_route_conflict", writes: 0 });
    assert.deepEqual(previewWildsExcavation(previewInput({
      safety: { ...previewInput().safety, rescueAnchor: { x: 100, y: 2, z: 100 } }
    })), { ok: false, code: "rescue_route_unreachable", writes: 0 });
  });

  it("rejects crossing and T-junction sibling capsules even when their midpoints differ", async () => {
    const graph = emptyWildsExcavationGraph(WORLD_ID, "world:head");
    const first = previewWildsExcavation(previewInput({ priorGraphHead: graph.head }));
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const admitted = await executeWildsExcavationAdmission({
      graph,
      preview: first.preview,
      expectedHeads: { "explorer:one": "explorer:one:head", "creature:borer": "creature:borer:head" },
      authority: { authorities: { "explorer:one": { actorSubjectId: "explorer:one", ownerReceizId: "receiz:one" }, "creature:borer": { actorSubjectId: "creature:borer", ownerReceizId: "receiz:one" } } },
      attemptId: "attempt:first",
      rail: successfulRail().rail,
      journal: memoryJournal()
    });
    assert.equal(admitted.ok, true);
    if (!admitted.ok) return;
    for (const geometry of [
      { from: { x: 14, y: sampleWildsTerrain(14, 4).elevation, z: 4 }, to: { x: 14, y: sampleWildsTerrain(14, 24).elevation, z: 24 }, radius: 1, surfaceExit: true, rescueRoute: true, flooded: false },
      { from: BASE_TO, to: { x: 26, y: sampleWildsTerrain(26, 14).elevation, z: 14 }, radius: 1, surfaceExit: true, rescueRoute: true, flooded: false }
    ]) {
      const crossing = previewWildsExcavation(previewInput({ priorGraphHead: admitted.graph.head, geometry, safety: { protectedVolumes: [], canonicalRoutes: [], rescueAnchor: geometry.from } }));
      assert.equal(crossing.ok, true);
      if (!crossing.ok) continue;
      const result = await executeWildsExcavationAdmission({
        graph: admitted.graph, preview: crossing.preview, expectedHeads: {}, authority: { authorities: {} }, attemptId: "attempt:cross", rail: successfulRail().rail, journal: memoryJournal()
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "geometry_conflict");
    }

    const linePoint = (amount: number) => ({
      x: BASE_FROM.x + (BASE_TO.x - BASE_FROM.x) * amount,
      y: BASE_FROM.y + (BASE_TO.y - BASE_FROM.y) * amount,
      z: BASE_FROM.z + (BASE_TO.z - BASE_FROM.z) * amount
    });
    for (const [from, to] of [[linePoint(.75), linePoint(1.75)], [linePoint(.9), linePoint(.2)], [linePoint(.25), linePoint(.75)]] as const) {
      const collinear = previewWildsExcavation(previewInput({
        priorGraphHead: admitted.graph.head,
        geometry: { from, to, radius: 1, surfaceExit: true, rescueRoute: true, flooded: false },
        safety: { protectedVolumes: [], canonicalRoutes: [], rescueAnchor: from }
      }));
      assert.equal(collinear.ok, true);
      if (!collinear.ok) continue;
      const result = await executeWildsExcavationAdmission({
        graph: admitted.graph, preview: collinear.preview, expectedHeads: {}, authority: { authorities: {} }, attemptId: "attempt:parallel", rail: successfulRail().rail, journal: memoryJournal()
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "geometry_conflict");
    }
  });

  it("rejects parallel canonical-route capsules at near and exact clearance boundaries", () => {
    const dx = BASE_TO.x - BASE_FROM.x;
    const dz = BASE_TO.z - BASE_FROM.z;
    const length = Math.hypot(dx, dz);
    for (const offset of [1.5, 2]) {
      const shift = { x: -dz / length * offset, z: dx / length * offset };
      const from = { x: BASE_FROM.x + shift.x, y: BASE_FROM.y, z: BASE_FROM.z + shift.z };
      const to = { x: BASE_TO.x + shift.x, y: BASE_TO.y, z: BASE_TO.z + shift.z };
      const result = previewWildsExcavation(previewInput({
        geometry: { from, to, radius: 1, surfaceExit: true, rescueRoute: true, flooded: false },
        safety: { protectedVolumes: [], canonicalRoutes: [{ id: "route:parallel", points: [BASE_FROM, BASE_TO] }], rescueAnchor: from }
      }));
      assert.deepEqual(result, { ok: false, code: "canonical_route_conflict", writes: 0 });
    }
  });

  it("binds exact participant/world heads and SDK digests through plan, validate, transaction, and execute", async () => {
    const graph = emptyWildsExcavationGraph(WORLD_ID, "world:head");
    const preview = previewWildsExcavation(previewInput({ priorGraphHead: graph.head }));
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    const { rail, calls, plannedInput, plannedInputs } = successfulRail();
    const result = await executeWildsExcavationAdmission({
      graph,
      preview: preview.preview,
      expectedHeads: { "explorer:one": "explorer:one:head", "creature:borer": "creature:borer:head" },
      authority: {
        authorities: {
          "explorer:one": { actorSubjectId: "explorer:one", ownerReceizId: "receiz:one" },
          "creature:borer": { actorSubjectId: "creature:borer", ownerReceizId: "receiz:one" }
        }
      },
      attemptId: "attempt:one",
      rail,
      journal: memoryJournal()
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(calls, { plan: 2, validate: 2, transaction: 1, execute: 1, resolve: 2 });
    assert.equal(plannedInput()?.expectedWorldHead, "world:head");
    assert.deepEqual(plannedInput()?.expectedHeads, { "explorer:one": "explorer:one:head", "creature:borer": "creature:borer:head" });
    assert.equal(plannedInput()?.idempotencyKey, preview.preview.idempotencyKey);
    if (!result.ok) return;
    assert.equal(result.graph.events.length, 1);
    assert.equal(result.graph.receizWorldHead, "world:next");
    const physical = projectWildsExcavationPhysicalGraph(result.graph);
    assert.equal(physical.segments.length, 1);
    assert.equal(JSON.stringify(physical).includes("explorer"), false);
    assert.equal(JSON.stringify(physical).includes("proof"), false);
    const publicRefs = projectWildsExcavationPublicFeatureRefs(result.graph);
    assert.equal(publicRefs.length, 1);
    assert.equal(publicRefs[0]!.featureId, physical.segments[0]!.id);
    const railPayload = JSON.stringify(plannedInputs().map((input) => input.payload));
    for (const secret of ["River", "Stonewing", "proof:explorer", "proof:creature", EXPLORER_IDENTITY_DIGEST, CREATURE_IDENTITY_DIGEST]) {
      assert.equal(railPayload.includes(secret), false, `rail payload leaked ${secret}`);
    }
    const before = wildsExcavationDiagnostics();
    for (let tick = 0; tick < 10_000; tick += 1) assert.equal(projectWildsExcavationPhysicalGraph(result.graph), physical);
    assert.deepEqual(wildsExcavationDiagnostics(), before);
  });

  it("recovers a committed installed-v121 transaction after its success response is lost", async () => {
    const runtime = createReceizLivingSubjectRuntime({ registryDigest: RECEIZ_V121_REGISTRY_DIGEST, reducerDigest: RECEIZ_LIVING_SUBJECT_REDUCER_DIGEST, initialKai: "123456" });
    const explorer = runtime.admitSubject({ subjectId: "explorer:one", proofObjectId: "proof:explorer", subjectType: "wildz.explorer", ownerReceizId: "receiz:one", identityDigest: EXPLORER_IDENTITY_DIGEST });
    const creature = runtime.admitSubject({ subjectId: "creature:borer", proofObjectId: "proof:creature", subjectType: "wildz.creature", ownerReceizId: "receiz:one", identityDigest: CREATURE_IDENTITY_DIGEST });
    const worldHead = runtime.world.replay({ worldId: WORLD_ID }).throughHead;
    const graph = emptyWildsExcavationGraph(WORLD_ID, worldHead);
    const preview = previewWildsExcavation(previewInput({ priorGraphHead: graph.head }));
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    const rail: WildsExcavationReceizPort = {
      resolvePhysicalEvidence: async (preview) => preview.physicalAuthority,
      resolveSubject: async (subjectId) => {
        const artifact = runtime.subjects.resolve(subjectId);
        return { subjectId, head: artifact.subject.head, registryDigest: artifact.registryDigest, reducerDigest: artifact.reducerDigest, proofObjectId: artifact.subject.proofObjectId, identityDigest: artifact.subject.identityDigest, currentOwnerReceizId: artifact.subject.currentOwnerReceizId, capabilityIdentityDigest: subjectId === "creature:borer" ? preview.preview.capability.identityDigest : null, conditionDigest: subjectId === "creature:borer" ? preview.preview.capability.conditionDigest : null };
      },
      planCommand: async (input) => runtime.world.planCommand(input),
      validateCommand: async (plan) => runtime.world.validateCommand(plan),
      planTransaction: async (input) => runtime.world.planTransaction(input),
      executeTransaction: async (plan, authority) => runtime.world.executeTransaction(plan, authority),
      additions: async (input) => runtime.world.additions(input)
    };
    const journal = memoryJournal();
    let discardSuccess = true;
    const lostResponseRail: WildsExcavationReceizPort = {
      ...rail,
      async executeTransaction(plan, authority) {
        const result = await rail.executeTransaction(plan, authority);
        if (discardSuccess) { discardSuccess = false; throw new Error("response_lost_after_commit"); }
        return result;
      }
    };
    const authority = { authorities: {
      "explorer:one": { actorSubjectId: "explorer:one", ownerReceizId: "receiz:one" },
      "creature:borer": { actorSubjectId: "creature:borer", ownerReceizId: "receiz:one" }
    } } as const;
    const result = await executeWildsExcavationAdmission({
      graph,
      preview: preview.preview,
      expectedHeads: { "explorer:one": explorer.subject.head, "creature:borer": creature.subject.head },
      authority,
      attemptId: "attempt:sdk-runtime",
      rail: lostResponseRail,
      journal
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "receiz_outcome_ambiguous");
    const recovered = await recoverWildsExcavationAdmission({ graph, idempotencyKey: preview.preview.idempotencyKey, authority, rail, journal });
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    if (!recovered.ok) return;
    assert.equal(recovered.graph.receizWorldHead, runtime.world.replay({ worldId: WORLD_ID }).throughHead);
    assert.equal(runtime.world.additions({ worldId: WORLD_ID }).length, 1);
  });

  it("persists exact planned bytes across an ambiguous response and retries them without regeneration", async () => {
    const graph = emptyWildsExcavationGraph(WORLD_ID, "world:head");
    const preview = previewWildsExcavation(previewInput({ priorGraphHead: graph.head }));
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    const journal = createPersistentWildsExcavationJournal("explorer:one", fakeContinuityDatabase());
    const successful = successfulRail();
    let first = true;
    let exactTransaction: ReceizWorldTransactionV1 | null = null;
    const rail: WildsExcavationReceizPort = {
      ...successful.rail,
      async executeTransaction(transaction, authority) {
        if (first) {
          first = false;
          exactTransaction = transaction;
          throw new Error("timeout_after_commit_unknown");
        }
        assert.equal(transaction, exactTransaction);
        return successful.rail.executeTransaction(transaction, authority);
      }
    };
    const input = {
      graph,
      preview: preview.preview,
      expectedHeads: { "explorer:one": "explorer:one:head", "creature:borer": "creature:borer:head" },
      authority: { authorities: {
        "explorer:one": { actorSubjectId: "explorer:one", ownerReceizId: "receiz:one" },
        "creature:borer": { actorSubjectId: "creature:borer", ownerReceizId: "receiz:one" }
      } },
      attemptId: "attempt:ambiguous",
      rail,
      journal
    } as const;
    const ambiguous = await executeWildsExcavationAdmission(input);
    assert.equal(ambiguous.ok, false);
    const pending = await journal.read(WORLD_ID, preview.preview.idempotencyKey);
    assert.ok(pending);
    await journal.stage({
      ...pending,
      transaction: { ...pending.transaction, expectedHeads: { ...pending.transaction.expectedHeads, "explorer:one": "forged:head" } }
    });
    const rejectedTamper = await recoverWildsExcavationAdmission({ graph, idempotencyKey: preview.preview.idempotencyKey, authority: input.authority, rail, journal });
    assert.equal(rejectedTamper.ok, false);
    if (!rejectedTamper.ok) assert.equal(rejectedTamper.code, "pending_admission_invalid");
    assert.equal(successful.calls.execute, 0);
    await journal.stage(pending);
    const forgedEvidenceRail: WildsExcavationReceizPort = {
      ...rail,
      async resolveSubject(subjectId) {
        const subject = await rail.resolveSubject(subjectId);
        return subjectId === "creature:borer" ? { ...subject, capabilityIdentityDigest: "sha256:forged-capability" } : subject;
      }
    };
    const rejectedEvidence = await recoverWildsExcavationAdmission({ graph, idempotencyKey: preview.preview.idempotencyKey, authority: input.authority, rail: forgedEvidenceRail, journal });
    assert.equal(rejectedEvidence.ok, false);
    if (!rejectedEvidence.ok) assert.equal(rejectedEvidence.code, "pending_participant_evidence_invalid");
    assert.ok(await journal.read(WORLD_ID, preview.preview.idempotencyKey));
    const recovered = await recoverWildsExcavationAdmission({ graph, idempotencyKey: preview.preview.idempotencyKey, authority: input.authority, rail, journal });
    assert.equal(recovered.ok, true);
    assert.equal(await journal.read(WORLD_ID, preview.preview.idempotencyKey), null);
  });

  it("keeps stale, foreign, tampered, and zero-write failures physically inert", async () => {
    const graph = emptyWildsExcavationGraph(WORLD_ID, "world:head");
    const preview = previewWildsExcavation(previewInput({ priorGraphHead: graph.head }));
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    const failure: ReceizWorldExecutionResultV1 = {
      ok: false,
      schema: "receiz.world.zero-write-failure.v1",
      code: "RECEIZ_WORLD_STALE_WORLD_HEAD",
      message: "stale",
      commandId: null,
      attemptId: null,
      writes: 0,
      currentHeads: {},
      worldHead: "world:new",
      registryDigest: "sdk-registry",
      reducerDigest: "sdk-reducer"
    };
    const failureJournal = memoryJournal();
    const failed = await executeWildsExcavationAdmission({
      graph,
      preview: preview.preview,
      expectedHeads: { "explorer:one": "explorer:one:head", "creature:borer": "creature:borer:head" },
      authority: { authorities: { "explorer:one": { actorSubjectId: "explorer:one", ownerReceizId: "receiz:one" }, "creature:borer": { actorSubjectId: "creature:borer", ownerReceizId: "receiz:one" } } },
      attemptId: "attempt:one",
      rail: successfulRail({ fail: failure }).rail,
      journal: failureJournal
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.graph, graph);
    assert.equal(await failureJournal.read(WORLD_ID, preview.preview.idempotencyKey) !== null, true);
    assert.deepEqual(projectWildsExcavationPhysicalGraph(graph), { segments: [], chambers: [] });

    const tampered = await executeWildsExcavationAdmission({
      graph,
      preview: preview.preview,
      expectedHeads: { "explorer:one": "explorer:one:head", "creature:borer": "creature:borer:head" },
      authority: { authorities: { "explorer:one": { actorSubjectId: "explorer:one", ownerReceizId: "receiz:one" }, "creature:borer": { actorSubjectId: "creature:borer", ownerReceizId: "receiz:one" } } },
      attemptId: "attempt:one",
      rail: successfulRail({ eventPayload: { forged: true } }).rail,
      journal: memoryJournal()
    });
    assert.equal(tampered.ok, false);
    assert.equal(tampered.graph, graph);
  });

  it("rejects altered plan heads/transaction bytes before execute and foreign receipt identity after execute", async () => {
    const graph = emptyWildsExcavationGraph(WORLD_ID, "world:head");
    const preview = previewWildsExcavation(previewInput({ priorGraphHead: graph.head }));
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    const basis = {
      graph, preview: preview.preview,
      expectedHeads: { "explorer:one": "explorer:one:head", "creature:borer": "creature:borer:head" },
      authority: { authorities: { "explorer:one": { actorSubjectId: "explorer:one", ownerReceizId: "receiz:one" }, "creature:borer": { actorSubjectId: "creature:borer", ownerReceizId: "receiz:one" } } },
      attemptId: "attempt:adversarial",
      journal: memoryJournal()
    } as const;
    const alteredPlan = successfulRail();
    const badPlanRail: WildsExcavationReceizPort = {
      ...alteredPlan.rail,
      async planCommand(input) {
        const plan = await alteredPlan.rail.planCommand(input);
        return { ...plan, priorHeads: { ...plan.priorHeads, "explorer:one": "foreign:head" } };
      }
    };
    const badPlan = await executeWildsExcavationAdmission({ ...basis, rail: badPlanRail });
    assert.equal(badPlan.ok, false);
    assert.equal(alteredPlan.calls.execute, 0);

    const alteredSafety = successfulRail();
    const badSafetyRail: WildsExcavationReceizPort = {
      ...alteredSafety.rail,
      resolvePhysicalEvidence: async (preview) => ({ ...preview.physicalAuthority, projectionDigest: "sha256:foreign-physical-authority" })
    };
    const badSafety = await executeWildsExcavationAdmission({ ...basis, journal: memoryJournal(), rail: badSafetyRail });
    assert.equal(badSafety.ok, false);
    if (!badSafety.ok) assert.equal(badSafety.code, "participant_proof_authority_invalid");
    assert.equal(alteredSafety.calls.execute, 0);

    const alteredTransaction = successfulRail();
    const badTransactionRail: WildsExcavationReceizPort = {
      ...alteredTransaction.rail,
      async planTransaction(input) {
        const transaction = await alteredTransaction.rail.planTransaction(input);
        return { ...transaction, commands: transaction.commands.slice(0, 1) };
      }
    };
    const badTransaction = await executeWildsExcavationAdmission({ ...basis, rail: badTransactionRail });
    assert.equal(badTransaction.ok, false);
    assert.equal(alteredTransaction.calls.execute, 0);

    const foreignReceipt = successfulRail();
    const foreignReceiptRail: WildsExcavationReceizPort = {
      ...foreignReceipt.rail,
      async executeTransaction(transaction, authority) {
        const result = await foreignReceipt.rail.executeTransaction(transaction, authority);
        if (!result.ok) return result;
        return { ...result, receipt: { ...result.receipt, actorSubjectId: "explorer:foreign" } };
      }
    };
    const foreign = await executeWildsExcavationAdmission({ ...basis, journal: memoryJournal(), rail: foreignReceiptRail });
    assert.equal(foreign.ok, false);
    if (!foreign.ok) assert.equal(foreign.code, "receiz_receipt_invalid");

    const foreignCausality = successfulRail();
    const foreignCausalityRail: WildsExcavationReceizPort = {
      ...foreignCausality.rail,
      async executeTransaction(transaction, authority) {
        const result = await foreignCausality.rail.executeTransaction(transaction, authority);
        if (!result.ok) return result;
        return { ...result, events: [{ ...result.events[0]!, causalParents: ["world:foreign"] }] };
      }
    };
    const causal = await executeWildsExcavationAdmission({ ...basis, journal: memoryJournal(), rail: foreignCausalityRail });
    assert.equal(causal.ok, false);
    if (!causal.ok) assert.equal(causal.code, "receiz_receipt_invalid");
  });

  it("replays append-only history and preserves durable idempotency beyond 512 events", async () => {
    const runtime = createReceizLivingSubjectRuntime({ registryDigest: RECEIZ_V120_REGISTRY_DIGEST, reducerDigest: RECEIZ_LIVING_SUBJECT_REDUCER_DIGEST, initialKai: "200000" });
    runtime.admitSubject({ subjectId: "explorer:one", proofObjectId: "proof:explorer", subjectType: "wildz.explorer", ownerReceizId: "receiz:one", identityDigest: EXPLORER_IDENTITY_DIGEST });
    runtime.admitSubject({ subjectId: "creature:borer", proofObjectId: "proof:creature", subjectType: "wildz.creature", ownerReceizId: "receiz:one", identityDigest: CREATURE_IDENTITY_DIGEST });
    const rail: WildsExcavationReceizPort = {
      resolvePhysicalEvidence: async (preview) => preview.physicalAuthority,
      resolveSubject: async (subjectId) => {
        const artifact = runtime.subjects.resolve(subjectId);
        const full = capabilityEvidence(["burrow", "break", "swim", "dive", "current", "resist", "anchor"]);
        return { subjectId, head: artifact.subject.head, registryDigest: artifact.registryDigest, reducerDigest: artifact.reducerDigest, proofObjectId: artifact.subject.proofObjectId, identityDigest: artifact.subject.identityDigest, currentOwnerReceizId: artifact.subject.currentOwnerReceizId, capabilityIdentityDigest: subjectId === "creature:borer" ? digestWildsExcavationCapabilityIdentity(full.identity) : null, conditionDigest: subjectId === "creature:borer" ? full.conditionDigest : null };
      },
      planCommand: async (input) => runtime.world.planCommand(input),
      validateCommand: async (plan) => runtime.world.validateCommand(plan),
      planTransaction: async (input) => runtime.world.planTransaction(input),
      executeTransaction: async (plan, authority) => runtime.world.executeTransaction(plan, authority),
      additions: async (input) => runtime.world.additions(input)
    };
    const authority = { authorities: {
      "explorer:one": { actorSubjectId: "explorer:one", ownerReceizId: "receiz:one" },
      "creature:borer": { actorSubjectId: "creature:borer", ownerReceizId: "receiz:one" }
    } } as const;
    let graph = emptyWildsExcavationGraph(WORLD_ID, runtime.world.replay({ worldId: WORLD_ID }).throughHead);
    let firstPreview: ReturnType<typeof previewWildsExcavation> | null = null;
    for (let index = 0; index < 513; index += 1) {
      const x = 1 + index % 23 * 5;
      const z = 1 + Math.floor(index / 23) * 5;
      const y = sampleWildsTerrain(x, z).elevation;
      const flooded = Array.from({ length: 9 }, (_, step) => sampleWildsTerrain(x + 2.1 * step / 8, z))
        .some((terrain) => (terrain.surface === "deep-water" || terrain.surface === "shallow-water") && y <= -1.1);
      const preview = previewWildsExcavation(previewInput({
        priorGraphHead: graph.head,
        capability: capabilityEvidence(["burrow", "break", "swim", "dive", "current", "resist", "anchor"]),
        geometry: { from: { x, y, z }, to: { x: x + 2.1, y, z }, radius: .9, surfaceExit: true, rescueRoute: true, flooded },
        safety: { protectedVolumes: [], canonicalRoutes: [], rescueAnchor: { x, y, z } }
      }));
      assert.equal(preview.ok, true);
      if (!preview.ok) return;
      firstPreview ??= preview;
      const explorer = runtime.subjects.state("explorer:one");
      const creature = runtime.subjects.state("creature:borer");
      const admitted = await executeWildsExcavationAdmission({
        graph,
        preview: preview.preview,
        expectedHeads: { "explorer:one": explorer.head, "creature:borer": creature.head },
        authority,
        attemptId: `attempt:${index}`,
        rail,
        journal: memoryJournal()
      });
      assert.equal(admitted.ok, true, admitted.ok ? undefined : admitted.code);
      if (!admitted.ok) return;
      graph = admitted.graph;
    }
    assert.equal(graph.events.length, 513);
    assert.equal(graph.idempotencyKeys.length, 513);
    assert.throws(() => replayWildsExcavationEvents(
      emptyWildsExcavationGraph(WORLD_ID, graph.events[0]!.receizPriorWorldHead),
      graph.events,
      () => false
    ), /wilds_excavation_evidence_unverified/);
    assert.equal(replayWildsExcavationEvents(
      emptyWildsExcavationGraph(WORLD_ID, graph.events[0]!.receizPriorWorldHead),
      graph.events,
      (event) => event.preview.creature.proofObjectId === "proof:creature"
        && event.preview.capability.identityDigest === digestWildsExcavationCapabilityIdentity(capabilityEvidence(["burrow", "break", "swim", "dive", "current", "resist", "anchor"]).identity)
    ).head, graph.head);
    assert.equal(firstPreview?.ok, true);
    if (!firstPreview?.ok) return;
    const replayed = await executeWildsExcavationAdmission({
      graph,
      preview: firstPreview.preview,
      expectedHeads: {},
      authority: { authorities: {} },
      attemptId: "attempt:replay",
      rail,
      journal: memoryJournal()
    });
    assert.equal(replayed.ok, true);
    assert.equal(replayed.graph, graph);
  });

  it("projects one privacy-safe maker mark for public entrances and separates creator from steward", () => {
    const base = {
      access: { mode: "public" as const, grantsDigest: "sha256:public" },
      creatorPublication: { publicAlias: "River", public: true, publicationHead: "profile:river:7" },
      creature: { proofDigest: "sha256:creature-secret", proofObjectId: "proof:creature", publicName: "Stonewing" },
      stewardPublication: { publicAlias: "Moss", public: true, publicationHead: "profile:moss:4" },
      creationKai: "123456",
      entrance: { x: 10, y: 3, z: 12 },
      biome: "stone"
    };
    const distant = projectWildsExcavationMakerMark(base, 10);
    assert.equal(distant?.details, null);
    assert.equal(distant?.creator, null);
    assert.equal(distant?.steward, null);
    const close = projectWildsExcavationMakerMark(base, 3);
    assert.equal(close?.creator, "River");
    assert.equal(close?.steward, "Moss");
    assert.equal(JSON.stringify(close).includes("creator-secret"), false);
    assert.equal(projectWildsExcavationMakerMark({ ...base, access: { mode: "private", grantsDigest: "sha256:private" } }, 2), null);
    assert.equal(projectWildsExcavationMakerMark({ ...base, creatorPublication: { ...base.creatorPublication, public: false } }, 2)?.creator, null);
  });

  it("keeps invited grants private, honors revocation, and publishes only redacted public feature refs", () => {
    const invited = previewWildsExcavation(previewInput({ access: { mode: "invited", invitedSubjectIds: ["explorer:friend"] } }));
    assert.deepEqual(invited, { ok: false, code: "private_access_envelope_required", writes: 0 });
    const access = { mode: "invited" as const, grantsDigest: "sha256:private-grants" };
    const grant = { grantsDigest: access.grantsDigest, actorSubjectId: "explorer:friend", admitted: true, revoked: false };
    assert.equal(compileWildsExcavationAccess({ access, actorSubjectId: "explorer:friend", ownerSubjectId: "explorer:one", privateGrant: grant }).enterable, true);
    assert.equal(compileWildsExcavationAccess({ access, actorSubjectId: "explorer:friend", ownerSubjectId: "explorer:one", privateGrant: { ...grant, revoked: true } }).enterable, false);
    const viewer = compileWildsExcavationViewerAccess("explorer:friend", [grant]);
    assert.equal(viewer.grants.get(access.grantsDigest)?.admitted, true);
    assert.deepEqual(projectWildsExcavationPublicFeatureRefs(emptyWildsExcavationGraph(WORLD_ID)), []);
  });
});

function authoredEventFixture() {
  const base = emptyWildsAuthoredWorldGraph(WORLD_ID);
  const result = previewWildsExcavation(previewInput({ priorGraphHead: base.graphHead }));
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("authored_fixture_invalid");
  const preview = result.preview;
  const authorityPreview = {
    schema: preview.schema,
    physical: false,
    previewDigest: preview.previewDigest,
    worldId: preview.worldId,
    siteKey: preview.siteKey,
    actorSubjectId: preview.actorSubjectId,
    creatureSubjectId: preview.creatureSubjectId,
    capability: preview.capability,
    substrate: preview.substrate,
    geometry: preview.geometry,
    safety: preview.safety,
    safetyDigest: preview.safetyDigest,
    physicalAuthority: preview.physicalAuthority,
    access: { mode: "public", grantsDigest: preview.access.grantsDigest },
    creationKai: preview.creationKai,
    priorGraphHead: preview.priorGraphHead,
    idempotencyKey: preview.idempotencyKey,
    candidateEventDigest: preview.candidateEventDigest
  };
  const command = {
    worldId: WORLD_ID,
    actorSubjectId: "explorer:one",
    kind: "wildz.excavation.append.v1",
    targetIds: ["creature:borer"],
    payload: {
      schema: "wildz.excavation.command_payload.v1",
      applicationId: "wildz.quest",
      worldRegion: preview.siteKey,
      domainRegistryDigest: WILDS_EXCAVATION_REGISTRY_DIGEST,
      domainReducerDigest: WILDS_EXCAVATION_REDUCER_DIGEST,
      priorGraphHead: preview.priorGraphHead,
      candidateEventDigest: preview.candidateEventDigest,
      preview: authorityPreview
    },
    expectedHeads: { "creature:borer": "creature:head", "explorer:one": "explorer:head" },
    expectedWorldHead: base.worldHead,
    attemptId: "attempt:authored",
    idempotencyKey: preview.idempotencyKey
  };
  const event = {
    schema: "receiz.world.event.v1" as const,
    eventId: "event:authored:one",
    commandId: "transaction:authored:one",
    worldId: WORLD_ID,
    kind: "world.transaction",
    actorSubjectId: "explorer:one",
    participantSubjectIds: ["creature:borer", "explorer:one"],
    payload: { commands: [command, { ...command, actorSubjectId: "creature:borer", kind: "wildz.excavation.creature_labor.v1", payload: { schema: "wildz.excavation.creature_labor_payload.v1" } }] },
    causalParents: [base.worldHead, "creature:head", "explorer:head"],
    priorHeads: command.expectedHeads,
    nextHeads: { "creature:borer": "creature:next", "explorer:one": "explorer:next" },
    priorWorldHead: base.worldHead,
    worldHead: "world:authored:one",
    kai: "123457",
    registryDigest: "sdk:registry",
    reducerDigest: "sdk:reducer"
  };
  return { base, event, preview };
}

function authoredStore() {
  let checkpoint: WildsAuthoredWorldCheckpoint | null = null;
  let commits = 0;
  const store: WildsAuthoredWorldStore = {
    read: async () => checkpoint,
    compareAndSwap: async (_worldId, expectedRevision, next) => {
      if ((checkpoint?.revision ?? 0) !== expectedRevision) return false;
      checkpoint = next;
      commits += 1;
      return true;
    }
  };
  return { store, checkpoint: () => checkpoint, commits: () => commits };
}

describe("persistent authored Wilds additions", () => {
  it("rebuilds a replayable physical graph from privacy-safe Receiz additions and commits graph+cursor atomically", async () => {
    const { event, preview } = authoredEventFixture();
    const persisted = authoredStore();
    let replays = 0;
    const graph = await hydrateWildsAuthoredWorld({
      worldId: WORLD_ID,
      store: persisted.store,
      rail: {
        additions: async () => [event],
        replay: async () => { replays += 1; return { schema: "receiz.world.checkpoint.v1", worldId: WORLD_ID, throughHead: event.worldHead, subjectHeads: event.nextHeads, events: [event] }; }
      },
      resolveEvidence: async () => preview.physicalAuthority
    });
    assert.equal(replays, 0);
    assert.equal(persisted.commits(), 1);
    assert.equal(persisted.checkpoint()?.graph, graph);
    assert.equal(graph.worldHead, event.worldHead);
    assert.equal(graph.features.length, 1);
    assert.equal(JSON.stringify(event.payload).includes("proof:creature"), false);
    assert.equal(JSON.stringify(event.payload).includes("Stonewing"), false);
  });

  it("fails closed for physical tampering and uses full replay for an additions gap without advancing the checkpoint", async () => {
    const { event, preview } = authoredEventFixture();
    const persisted = authoredStore();
    await assert.rejects(hydrateWildsAuthoredWorld({
      worldId: WORLD_ID,
      store: persisted.store,
      rail: { additions: async () => [event], replay: async () => { throw new Error("not expected"); } },
      resolveEvidence: async () => ({ ...preview.physicalAuthority, flooded: !preview.physicalAuthority.flooded })
    }), /physical_evidence_invalid/);
    assert.equal(persisted.commits(), 0);

    const gap = { ...event, priorWorldHead: "foreign:head", causalParents: ["foreign:head", ...event.causalParents.slice(1)] };
    const rebuilt = await hydrateWildsAuthoredWorld({
      worldId: WORLD_ID,
      store: persisted.store,
      rail: {
        additions: async () => [gap],
        replay: async () => ({ schema: "receiz.world.checkpoint.v1", worldId: WORLD_ID, throughHead: event.worldHead, subjectHeads: event.nextHeads, events: [event] })
      },
      resolveEvidence: async () => preview.physicalAuthority
    });
    assert.equal(rebuilt.worldHead, event.worldHead);
    assert.equal(persisted.commits(), 1);
  });

  it("shares one immutable composed projection with every runtime consumer and performs zero warm rebuilds", async () => {
    const { event, preview } = authoredEventFixture();
    const persisted = authoredStore();
    const graph = await hydrateWildsAuthoredWorld({
      worldId: WORLD_ID,
      store: persisted.store,
      rail: { additions: async () => [event], replay: async () => { throw new Error("not expected"); } },
      resolveEvidence: async () => preview.physicalAuthority
    });
    const natural = admitWildsDiscoveryPhysicalNeighborhood(0, 0);
    const viewer = compileWildsExcavationViewerAccess("explorer:one", []);
    const before = wildsAuthoredWorldDiagnostics();
    const composed = composeWildsAuthoredPhysicalNeighborhood(natural, graph, viewer);
    const afterBuild = wildsAuthoredWorldDiagnostics();
    assert.equal(afterBuild.composedBuilds, before.composedBuilds + 1);
    assert.ok(composed.surfaces.some((surface) => surface.id.includes(graph.features[0]!.featureId)));
    for (let frame = 0; frame < 10_000; frame += 1) {
      assert.equal(composeWildsAuthoredPhysicalNeighborhood(natural, graph, viewer), composed);
    }
    assert.equal(wildsAuthoredWorldDiagnostics().composedBuilds, afterBuild.composedBuilds);
    assert.equal(Object.isFrozen(composed), true);
  });

  it("appends connected bare chambers without material spend and enforces head-bound access and atomic stewardship", async () => {
    const { event, preview } = authoredEventFixture();
    const persisted = authoredStore();
    let graph = await hydrateWildsAuthoredWorld({
      worldId: WORLD_ID,
      store: persisted.store,
      rail: { additions: async () => [event], replay: async () => { throw new Error("not expected"); } },
      resolveEvidence: async () => preview.physicalAuthority
    });
    const segment = graph.features[0]!;
    graph = appendWildsAuthoredMutation(graph, {
      schema: "wildz.authored-world.mutation.v1", kind: "append-chamber", eventId: "event:chamber", idempotencyKey: "chamber:one",
      priorGraphHead: graph.graphHead, actorSubjectId: "explorer:one", participantSubjectIds: ["explorer:one"],
      parentFeatureId: segment.featureId, center: { ...preview.geometry.to, x: preview.geometry.to.x + 1 }, radius: 3, flooded: false
    });
    assert.equal(graph.features[1]?.kind, "chamber");
    assert.equal(JSON.stringify(graph).includes("materialBalance"), false);
    graph = appendWildsAuthoredMutation(graph, {
      schema: "wildz.authored-world.mutation.v1", kind: "access-policy", eventId: "event:access", idempotencyKey: "access:one",
      priorGraphHead: graph.graphHead, actorSubjectId: "explorer:one", participantSubjectIds: ["explorer:one"],
      featureId: segment.featureId, access: { mode: "invited", grantsDigest: "sha256:private-envelope" }
    });
    const priorCreator = graph.features[0]?.ownerSubjectId;
    graph = appendWildsAuthoredMutation(graph, {
      schema: "wildz.authored-world.mutation.v1", kind: "stewardship-transfer", eventId: "event:steward", idempotencyKey: "steward:one",
      priorGraphHead: graph.graphHead, actorSubjectId: "explorer:one", participantSubjectIds: ["explorer:friend", "explorer:one"],
      featureId: segment.featureId, recipientSubjectId: "explorer:friend", accepted: true
    });
    assert.equal(graph.features[0]?.ownerSubjectId, priorCreator);
    assert.equal(graph.features[0]?.stewardSubjectId, "explorer:friend");
    assert.throws(() => appendWildsAuthoredMutation(graph, {
      schema: "wildz.authored-world.mutation.v1", kind: "access-policy", eventId: "event:stale", idempotencyKey: "access:stale",
      priorGraphHead: "stale", actorSubjectId: "explorer:friend", participantSubjectIds: ["explorer:friend"],
      featureId: segment.featureId, access: { mode: "public", grantsDigest: "sha256:public" }
    }), /mutation_stale/);
  });
});
