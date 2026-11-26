import assert from "node:assert/strict";
import { it } from "node:test";
import { createReceizInMemoryOfflineProofQueueStorage } from "@receiz/sdk";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { combineCreationTechniques, projectCreationWorkers } from "../src/features/play/creation/capabilities";
import { compileCreation, type CreationCompileContext } from "../src/features/play/creation/compiler";
import { createCreationDefinition } from "../src/features/play/creation/definition";
import { selectCreationResources } from "../src/features/play/creation/resources";
import { creationWorldAvailability, creationWorldSourceHead } from "../src/features/play/creation/world-source";
import { createKaiTemporalRoot } from "../src/features/play/kai-temporal-root";
import { deriveKaiKlokMomentFromUPulse, kaiUPulseToISOString } from "../src/features/play/kai-klok-moment";
import { regionForPosition } from "../src/features/play/multiplayer-core";
import { sealCollectedCard, sha256PortableBasis } from "../src/features/play/portable-card";
import { WILDS_CITY_RULES_DIGEST, WILDS_CLAN_RULES_DIGEST, reviewWildsCityFootprint, wildsCityCellAt, wildsCityFoundingAnchors, wildsCityPopulation, type WildsCityFoundingAnchor } from "../src/features/play/wilds-city";
import { projectWildsProductionPlacementEvidence } from "../src/features/play/wilds-construction-placement";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { settleWildsBuild } from "../src/features/play/wilds-steward-build-settlement";
import { createWildsMaterialHarvest, createWildsStewardHarvestOperation, createWildsStewardStructureOperation, createWildsTrailShelter, initialWildsHarvestedSourceState, playerStewardBuilder } from "../src/features/play/wilds-steward-construction";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import { previewWildsBlueprintPlacement } from "../src/features/play/wilds-world-construction";
import { createWildsWorldEvent } from "../src/features/play/wilds-world-event";
import { wildsWorldSourceEmission } from "../src/features/play/wilds-world-genesis";
import { acknowledgeWildsWorldCommand, createWildsWorldEdgeAdmissionQueue, persistWildsWorldCommandDurably, preserveWildsConstructionHistory, restoreWildsWorldEdgeSource, type WildsWorldOutboxEntry } from "../src/features/play/wilds-world-outbox";
import { WildsWorldService, type WildsWorldCommand } from "../src/features/play/wilds-world-service";
import { replayWildsWorld } from "../src/features/play/wilds-world-state";

import { applyWildsAtlasCivicEvent, mergeWildsAtlasSource } from "../src/features/play/wilds-atlas-receiz-projection";
import { createInitialWildsExplorationAtlas, revealWildsExplorationAt } from "../src/features/play/wilds-exploration-atlas";
import { projectWildsAtlas } from "../src/features/play/wilds-world-atlas";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";

const BASE_KAI = 2_000_000;
const FOUNDER = "cityfounder";
const OWNER = `${FOUNDER}.receiz.id`;
const RESIDENT = "cityresident";

function execute(service: WildsWorldService, command: WildsWorldCommand, actorId = FOUNDER, kaiUPulse = BASE_KAI + service.snapshot().revision + 1) {
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse: kaiUPulse, authority: "local" });
  const at = kaiUPulseToISOString(moment.uPulse);
  return service.execute({ ...command, kai: createKaiTemporalRoot(moment) }, { actorId, canonical: true, pulse: at, occurredAt: at, uPulse: moment.uPulse });
}

it("rejects an exit from an unknown city with zero writes", () => {
  const service = new WildsWorldService();
  const before = service.checkpoint();
  assert.throws(() => execute(service, {
    type: "city.residency.leave", cityId: "city:unadmitted", expectedRevision: 1, expectedHead: "unknown", commandId: "city:missing:exit"
  }), /wilds_city_revision_stale/);
  assert.deepEqual(service.checkpoint(), before);
  assert.deepEqual(service.events(), []);
});

function admitMaterials(service: WildsWorldService, kinds: readonly ("timber" | "stone")[]) {
  const resources = [-2, -1, 0].flatMap(z => projectWildsResourceRegion(-2, z));
  const used = new Set<string>();
  return kinds.map((kind, index) => {
    const source = resources.find(item => item.kind === kind && !used.has(item.sourceId));
    assert.ok(source);
    used.add(source.sourceId);
    const current = initialWildsHarvestedSourceState(source);
    const kaiUPulse = BASE_KAI + service.snapshot().revision + 1;
    const result = createWildsMaterialHarvest({
      source, current, ownerReceizId: OWNER, actorPosition: source.position, kaiUPulse
    });
    const operation = createWildsStewardHarvestOperation({
      source, currentSource: current, harvestedSource: result.source, lot: result.lot, ownerReceizId: OWNER,
      playerHead: sha256PortableBasis(OWNER), kaiUPulse
    });
    const settlement = settleWildsBuild({ operation, currentEmission: wildsWorldSourceEmission(service.snapshot()), actorId: OWNER });
    const command = {
      type: "resource.material.harvest" as const, commandId: `city:test:harvest:${index}`, source, sourceHead: current.head, actorPosition: source.position, operation,
      ...(settlement.emission ? { emission: settlement.emission, amountPhiMicro: settlement.amountPhiMicro, phiAward: settlement.phiAward } : {})
    };
    execute(service, command, OWNER, kaiUPulse);
    return result.lot;
  });
}

function buildShelter(service: WildsWorldService) {
  const lots = admitMaterials(service, ["timber", "timber", "stone"]);
  const world = service.snapshot();
  const position = Array.from({ length: 36 }, (_, i) => ({ x: 27 + i % 6 * 6, z: 27 + Math.floor(i / 6) * 6 }))
    .find(point => reviewWildsCityFootprint(world, { kind: "structure", id: "test", head: "pending", position: point, label: "Test" }, [wildsCityCellAt(point)]).ok);
  assert.ok(position);
  const kaiUPulse = BASE_KAI + service.snapshot().revision + 1;
  const shelter = createWildsTrailShelter({
    ownerReceizId: OWNER, position: { ...position, y: sampleWildsTerrain(position.x, position.z).elevation },
    rotationQuarterTurns: 0, lots, builder: playerStewardBuilder(OWNER), existingStructures: [], kaiUPulse
  });
  const operation = createWildsStewardStructureOperation({ structure: shelter, lots, ownerReceizId: OWNER, playerHead: sha256PortableBasis(OWNER) });
  const settlement = settleWildsBuild({ operation, currentEmission: wildsWorldSourceEmission(world), actorId: OWNER });
  execute(service, { type: "structure.trail-shelter.build", position, actorPosition: position,
    rotationQuarterTurns: 0, lotIds: lots.map(lot => lot.lotId), commandId: "city:test:shelter", ...settlement }, OWNER, kaiUPulse);
  return shelter;
}

function foundCity(service: WildsWorldService) {
  const shelter = buildShelter(service);
  const [anchor] = wildsCityFoundingAnchors(service.snapshot(), FOUNDER);
  assert.ok(anchor);
  assert.equal(anchor.id, shelter.structureId);
  const command = {
    type: "city.found" as const, name: "Juniper Reach", anchor: { kind: anchor.kind, id: anchor.id, head: anchor.head },
    cells: [wildsCityCellAt(anchor.position)], rulesDigest: WILDS_CITY_RULES_DIGEST, commandId: "city:test:found"
  };
  const before = service.snapshot();
  assert.throws(() => execute(service, command, RESIDENT), /wilds_city_anchor_invalid/);
  assert.equal(service.snapshot(), before);
  const admitted = execute(service, command);
  const city = Object.values(admitted.projection.cities ?? {})[0]!;
  assert.equal(wildsCityPopulation(city), 1);
  assert.deepEqual(admitted.projection.consumedMaterialLots, before.consumedMaterialLots);
  assert.equal(admitted.projection.structures[shelter.structureId], before.structures[shelter.structureId]);
  return { city, command, admitted };
}

it("reviews whole cells around verified foundations and preserves funding and object history on cold reopen", () => {
  const service = new WildsWorldService();
  const { city, command, admitted } = foundCity(service);
  assert.equal(city.name, "Juniper Reach");
  assert.equal(city.founderId, FOUNDER);
  assert.deepEqual(city.cells, command.cells);
  assert.equal(city.history[0]?.eventId, admitted.events[0]?.eventId);
  assert.deepEqual(replayWildsWorld(service.events()), service.snapshot());
  const cold = new WildsWorldService({ checkpoint: JSON.parse(JSON.stringify(service.checkpoint())) });
  assert.deepEqual(cold.snapshot().cities, service.snapshot().cities);
  assert.deepEqual(cold.snapshot().structures, service.snapshot().structures);
  assert.deepEqual(cold.snapshot().consumedMaterialLots, service.snapshot().consumedMaterialLots);
  const exact = execute(cold, command, FOUNDER, admitted.events[0]!.uPulse);
  assert.deepEqual(exact.events, []);
  assert.throws(() => execute(cold, { ...command, name: "Other" }, FOUNDER, admitted.events[0]!.uPulse), /command_conflict/);
  assert.throws(() => execute(cold, { ...command, commandId: "city:test:second" }), /wilds_city_anchor_already_used/);
});

it("admits a completed contributed component while excluding plans and reserved materials", () => {
  const service = new WildsWorldService();
  const lots = admitMaterials(service, ["stone", "stone", "stone", "timber"]);
  const position = { x: 27, z: 27 };
  execute(service, { type: "construction.project.create", name: "North Commons", region: regionForPosition(position), commandId: "city:component:project" }, OWNER);
  const project = Object.values(service.snapshot().constructionProjects)[0]!;
  const request = { pointer: { ...position, y: sampleWildsTerrain(position.x, position.z).elevation }, rotationQuarterTurns: 0, heightStep: 0 };
  const evidence = projectWildsProductionPlacementEvidence(service.snapshot(), project.projectId, request);
  const placement = previewWildsBlueprintPlacement({ ...evidence, blueprint: evidence.sourceBlueprint, kind: "foundation" });
  assert.equal(placement.valid, true, JSON.stringify(placement.cues));
  execute(service, { type: "construction.component.place", projectId: project.projectId, placement, request, actorPosition: position, commandId: "city:component:place" }, OWNER);
  const component = Object.values(service.snapshot().constructionComponents)[0]!;
  const basis = { componentId: component.componentId, componentHead: component.head, actorPosition: position };
  assert.deepEqual(wildsCityFoundingAnchors(service.snapshot(), FOUNDER), []);
  execute(service, { type: "construction.component.deposit", ...basis, lotIds: lots.map(lot => lot.lotId), commandId: "city:component:deposit" }, OWNER);
  assert.deepEqual(wildsCityFoundingAnchors(service.snapshot(), FOUNDER), []);
  execute(service, { type: "construction.component.work", ...basis, commandId: "city:component:frame" }, OWNER);
  assert.deepEqual(wildsCityFoundingAnchors(service.snapshot(), FOUNDER), []);
  execute(service, { type: "construction.component.work", ...basis, commandId: "city:component:functional" }, OWNER);
  const [anchor] = wildsCityFoundingAnchors(service.snapshot(), FOUNDER);
  assert.ok(anchor);
  assert.equal(anchor.kind, "component");
  const effects = execute(service, { type: "city.found", name: "North Commons", anchor: { kind: "component", id: anchor.id, head: anchor.head },
    cells: [wildsCityCellAt(anchor.position)], rulesDigest: WILDS_CITY_RULES_DIGEST, commandId: "city:component:found" });
  const city = Object.values(effects.projection.cities ?? {})[0]!;
  assert.equal(city.anchor.materialLots.length, 4);
  assert.equal(city.anchor.work.length, 2);
  assert.deepEqual(replayWildsWorld(service.events()), service.snapshot());
});

it("founds a city on a functional prompt creation's retained event and spent lots", () => {
  const service = new WildsWorldService();
  admitMaterials(service, ["timber"]);
  const world = service.snapshot();
  const card = sealCollectedCard({ capturedAt: kaiUPulseToISOString(BASE_KAI), encounterId: "city-prompt-worker", formId: "mintcub-1", ownerReceizId: OWNER });
  const condition = emptyAdventureCondition(card.id);
  const definition = createCreationDefinition({ schema: "wildz.creation-definition.v1", grammarVersion: 1, seed: "Alderwash trail shelter", creatorId: OWNER, assets: [],
    nodes: [{ id: "shelter-bench", parentId: null, pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 },
      shape: { kind: "box", width: 0.8, height: 0.3, depth: 0.8 }, material: "timber", attachments: [], supports: [], behaviors: [] }] });
  const context: CreationCompileContext = {
    worldId: world.worldId, spaceId: "wildz.space.outer.v1", pose: { position: { x: 27, y: sampleWildsTerrain(27, 27).elevation, z: 27 }, yaw: 0 },
    sourceHead: creationWorldSourceHead(world), budget: { timber: 1 }, quality: "low", physical: [],
    techniques: combineCreationTechniques(projectCreationWorkers([card], { [card.id]: condition }))
  };
  const compiled = compileCreation(definition, context);
  assert.equal(compiled.status, "ready");
  if (compiled.status !== "ready") throw new Error("creation_fixture_compile");
  const resources = selectCreationResources(Object.values(world.materialLots), context.budget, compiled.plan.requiredResources, creationWorldAvailability(world, OWNER));
  assert.deepEqual(resources.deficits, {});
  const instanceId = "creation:city:alderwash-shelter";
  const built = execute(service, { type: "creation.construct", commandId: "creation:city:construct", instanceId, definition, context, planDigest: compiled.plan.digest,
    workerSources: [{ card, condition }], resources: resources.lots, actorPosition: context.pose.position }, OWNER);
  const instance = built.projection.creations![instanceId]!.instance;
  assert.equal(instance.stage, "functional");
  const cells = [wildsCityCellAt(instance.pose.position)];
  const command = { type: "city.found", name: "Alderwash", rulesDigest: WILDS_CITY_RULES_DIGEST,
    anchor: { kind: "creation", id: instanceId, head: instance.head }, cells, commandId: "city:alderwash:found" } as const;
  assert.deepEqual(wildsCityFoundingAnchors({ ...service.snapshot(), creationEvents: {} }, FOUNDER), []);
  assert.deepEqual(wildsCityFoundingAnchors({ ...service.snapshot(), consumedMaterialLots: {} }, FOUNDER), []);
  assert.throws(() => execute(service, command, RESIDENT), /wilds_city_anchor_invalid/);
  assert.throws(() => execute(service, { ...command, anchor: { ...command.anchor, head: "sha256:" + "a".repeat(64) } }), /wilds_city_anchor_invalid/);
  const [anchor] = wildsCityFoundingAnchors(service.snapshot(), FOUNDER);
  assert.equal(anchor?.kind, "creation");
  const admitted = execute(service, command).projection;
  const city = Object.values(admitted.cities ?? {})[0]!;
  assert.equal(city.anchor.head, instance.head);
  assert.equal(city.anchor.sourceEventId, built.events[0]?.eventId);
  assert.equal(city.anchor.materialLots[0]?.id, resources.lots[0]?.id);
  assert.deepEqual(admitted.creations, built.projection.creations);
  assert.deepEqual(replayWildsWorld(service.events()), service.snapshot());
});

it("protects an authored route and landmarks and rejects a disconnected footprint", () => {
  const world = new WildsWorldService().snapshot();
  const review = (position: WildsCityFoundingAnchor["position"], cells = [wildsCityCellAt(position)]) => reviewWildsCityFootprint(world,
    { kind: "structure", id: "test", head: "pending", position, label: "Test" }, cells);
  assert.deepEqual(review({ x: 176, z: 76 }), { ok: false, reason: "wilds_city_cell_route_protected" });
  assert.deepEqual(review({ x: 96, z: 144 }), { ok: false, reason: "wilds_city_cell_landmark_protected" });
  const center = wildsCityCellAt({ x: 27, z: 27 });
  assert.deepEqual(review({ x: 27, z: 27 }, [center, { x: center.x + 1, z: center.z + 1 }]), {
    ok: false, reason: "wilds_city_cells_disconnected"
  });
});

it("counts accepted residents and records revision-bound city voting independently of clans", () => {
  const service = new WildsWorldService();
  const { city } = foundCity(service);
  const current = () => service.snapshot().cities![city.id]!;
  const cityScope = () => ({ cityId: city.id, expectedRevision: current().revision, expectedHead: current().head });
  const request = { type: "city.residency.request" as const, ...cityScope(), rulesDigest: WILDS_CITY_RULES_DIGEST, commandId: "city:resident:request" };
  execute(service, request, `${RESIDENT}.receiz.id`);
  assert.equal(wildsCityPopulation(current()), 1);
  assert.equal(current().applications[RESIDENT]?.actorId, `${RESIDENT}.receiz.id`);
  assert.throws(() => execute(service, { type: "city.residency.accept", ...cityScope(), applicantId: RESIDENT, commandId: "city:resident:selfaccept" }, RESIDENT), /wilds_city_membership_required/);
  execute(service, { type: "city.residency.accept", ...cityScope(), applicantId: `${RESIDENT}.receiz.id`, commandId: "city:resident:accept" });
  assert.equal(wildsCityPopulation(current()), 2);
  execute(service, { type: "clan.create", name: "Grove Runners", rulesDigest: WILDS_CLAN_RULES_DIGEST, commandId: "clan:test:create" }, RESIDENT);
  const clans = service.snapshot().clans!;
  const clan = Object.values(clans)[0]!;
  execute(service, { type: "clan.join", clanId: clan.id, expectedRevision: clan.revision, expectedHead: clan.head, rulesDigest: WILDS_CLAN_RULES_DIGEST, commandId: "clan:test:join" }, "trailscout");
  assert.ok(!current().members.trailscout);
  const plan = "Volunteers inspect trail signs each week.";
  execute(service, { type: "city.proposal.open", ...cityScope(), plan, commandId: "city:proposal:open" });
  const proposalId = current().activeProposalId!;
  const vote = { type: "city.proposal.vote" as const, ...cityScope(), proposalId, vote: "yes" as const, commandId: "city:proposal:vote" };
  assert.throws(() => execute(service, vote, "trailscout"), /wilds_city_vote_ineligible/);
  assert.throws(() => execute(service, { ...vote, expectedHead: "sha256:" + "a".repeat(64) }, RESIDENT), /wilds_city_revision_stale/);
  execute(service, vote, RESIDENT);
  assert.equal(current().maintenancePlan, plan);
  assert.equal(current().activeProposalId, null);
  assert.equal(current().proposals[proposalId]?.result?.reason, "unanimous");
  assert.deepEqual(replayWildsWorld(service.events()), service.snapshot());
});

it("balances a resident's voluntary exit with a preserved unresolved electorate", () => {
  const service = new WildsWorldService();
  const { city } = foundCity(service);
  const current = () => service.snapshot().cities![city.id]!;
  const cityScope = () => ({ cityId: city.id, expectedRevision: current().revision, expectedHead: current().head });
  execute(service, { type: "city.residency.request", ...cityScope(), rulesDigest: WILDS_CITY_RULES_DIGEST, commandId: "city:departure:request" }, RESIDENT);
  execute(service, { type: "city.residency.accept", ...cityScope(), applicantId: RESIDENT, commandId: "city:departure:accept" });
  execute(service, { type: "city.proposal.open", ...cityScope(), plan: "Organize shelter inspections.", commandId: "city:departure:proposal" });
  const proposalId = current().activeProposalId!;
  execute(service, { type: "city.residency.leave", ...cityScope(), commandId: "city:departure:leave" }, RESIDENT);
  assert.equal(wildsCityPopulation(current()), 1);
  assert.equal(current().proposals[proposalId]?.result?.reason, "electorate-changed");
  assert.deepEqual(current().proposals[proposalId]?.electorate, [FOUNDER, RESIDENT]);
  assert.equal(current().maintenancePlan, null);
});

it("rejects a missing or altered Kai root and a rebased event with an altered command", () => {
  const service = new WildsWorldService();
  const clan = { type: "clan.create" as const, name: "Trail Scouts", rulesDigest: WILDS_CLAN_RULES_DIGEST, commandId: "clan:kai:exact" };
  const at = kaiUPulseToISOString(BASE_KAI);
  const authority = { actorId: FOUNDER, canonical: true, pulse: at, occurredAt: at, uPulse: BASE_KAI };
  assert.throws(() => service.execute(clan, authority), /wilds_world_kai_root_required/);
  const root = createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: BASE_KAI, authority: "local" }));
  assert.throws(() => service.execute({ ...clan, kai: { ...root, coordinate: "tampered" } }, authority), /wilds_civic_kai_invalid/);
  assert.equal(service.snapshot().revision, 0);
  const [event] = service.execute({ ...clan, kai: root }, authority).events;
  assert.ok(event);
  const payload = event.payload as { command: typeof clan; constitutionalCommand: unknown };
  const { kind, actorId, causeId, pulse, occurredAt, uPulse, kaiKlok, previousEventId } = event;
  const changed = createWildsWorldEvent({ kind, actorId, causeId, pulse, occurredAt, uPulse, kaiKlok, previousEventId,
    payload: { ...payload, command: { ...payload.command, name: "Rebased" } } });
  assert.throws(() => replayWildsWorld([changed]), /wilds_civic_command_binding_invalid/);
});

it("reopens exact city and clan source after acknowledgement with no external reads", async () => {
  const service = new WildsWorldService();
  buildShelter(service);
  const [anchor] = wildsCityFoundingAnchors(service.snapshot(), FOUNDER);
  assert.ok(anchor);
  const storage = createReceizInMemoryOfflineProofQueueStorage();
  const queue = createWildsWorldEdgeAdmissionQueue({ initialProjection: service.snapshot(),
    persist: entry => persistWildsWorldCommandDurably(entry, storage) });
  const admit = async (command: WildsWorldCommand) => {
    const uPulse = BASE_KAI + queue.current().revision + 1;
    const entry: WildsWorldOutboxEntry = { schema: "receiz.wilds_world_outbox_entry.v1", actorId: FOUNDER, guestId: "unused-guest", queuedAt: kaiUPulseToISOString(uPulse),
      command: { ...command, kai: createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse, authority: "local" })) } };
    await queue.admit(entry);
    await acknowledgeWildsWorldCommand(FOUNDER, command.commandId, storage);
  };
  await admit({ type: "city.found", name: "Juniper Reach", anchor: { kind: anchor.kind, id: anchor.id, head: anchor.head }, cells: [wildsCityCellAt(anchor.position)],
    rulesDigest: WILDS_CITY_RULES_DIGEST, commandId: "city:cold:found" });
  await admit({ type: "clan.create", name: "Grove Runners", rulesDigest: WILDS_CLAN_RULES_DIGEST, commandId: "city:cold:clan" });
  const expected = queue.current();
  const reopened = await restoreWildsWorldEdgeSource(new WildsWorldService().snapshot(), FOUNDER, storage);
  assert.deepEqual(reopened, expected);
  assert.equal(Object.keys(reopened.cities ?? {}).length, 1);
  assert.equal(Object.keys(reopened.clans ?? {}).length, 1);
  assert.deepEqual(reopened.structures, service.snapshot().structures);
  assert.deepEqual(reopened.consumedMaterialLots, service.snapshot().consumedMaterialLots);
});

it("retains the complete admitted branch when a newer raw transport drops or rewrites its civic history", () => {
  const service = new WildsWorldService();
  const { city } = foundCity(service);
  execute(service, { type: "clan.create", name: "Grove Runners", rulesDigest: WILDS_CLAN_RULES_DIGEST, commandId: "clan:source:create" });
  const held = service.snapshot();
  const stripped = { ...held, cities: {}, revision: held.revision + 100 };
  assert.equal(preserveWildsConstructionHistory(held, stripped), held);
  const strippedClan = { ...held, clans: {}, revision: held.revision + 100 };
  assert.equal(preserveWildsConstructionHistory(held, strippedClan), held);
  execute(service, { type: "city.proposal.open", cityId: city.id, expectedRevision: city.revision, expectedHead: city.head, plan: "Inspect the shelter.", commandId: "city:source:proposal" });
  const descendant = service.snapshot();
  assert.equal(preserveWildsConstructionHistory(held, descendant), descendant);
  const forged = { ...descendant, cities: { [city.id]: { ...descendant.cities![city.id]!, maintenancePlan: "Unauthorized replacement" } } };
  assert.equal(preserveWildsConstructionHistory(held, forged), held);
});

it("refuses to write a stale civic source from a second tab", async () => {
  const initialProjection = new WildsWorldService().snapshot();
  const storage = createReceizInMemoryOfflineProofQueueStorage();
  const options = { initialProjection, persist: (entry: WildsWorldOutboxEntry) => persistWildsWorldCommandDurably(entry, storage) };
  const firstTab = createWildsWorldEdgeAdmissionQueue(options);
  const staleTab = createWildsWorldEdgeAdmissionQueue(options);
  const entry = (name: string, uPulse: number): WildsWorldOutboxEntry => ({
    schema: "receiz.wilds_world_outbox_entry.v1", actorId: FOUNDER, guestId: "unused-guest", queuedAt: kaiUPulseToISOString(uPulse),
    command: { type: "clan.create", name, rulesDigest: WILDS_CLAN_RULES_DIGEST, commandId: `clan:tab:${uPulse}`,
      kai: createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse, authority: "local" })) }
  });
  await firstTab.admit(entry("First tab", BASE_KAI + 1));
  const durable = storage.readText();
  await assert.rejects(staleTab.admit(entry("Stale tab", BASE_KAI + 2)), /wilds_civic_durable_source_conflict/);
  assert.equal(storage.readText(), durable);
  assert.equal(staleTab.current(), initialProjection);
  staleTab.adopt(await restoreWildsWorldEdgeSource(initialProjection, FOUNDER, storage));
  assert.equal(Object.keys((await staleTab.admit(entry("Fresh tab", BASE_KAI + 3))).clans ?? {}).length, 2);
});

it("projects the same building and city to two explorers and preserves separate discovery", () => {
  const founder = new WildsWorldService();
  const shelter = buildShelter(founder);
  const buildings = founder.snapshot();
  const [anchor] = wildsCityFoundingAnchors(buildings, FOUNDER);
  assert.ok(anchor);
  const command = { type: "city.found" as const, name: "Juniper Reach", anchor: { kind: anchor.kind, id: anchor.id, head: anchor.head },
    cells: [wildsCityCellAt(anchor.position)], rulesDigest: WILDS_CITY_RULES_DIGEST, commandId: "atlas:proof:found" };
  const founded = execute(founder, command);
  const civics = applyWildsAtlasCivicEvent(buildings, founded.events[0]!, OWNER);
  const shared = { buildings, civics };
  const viewerBefore = { ...initialWildsWorldProjection(), revision: 50 };
  const explorerView = mergeWildsAtlasSource(viewerBefore, shared);
  const charted = revealWildsExplorationAt(createInitialWildsExplorationAtlas(), shelter.position);
  const atlas = (world: typeof explorerView, owner: string, explorationAtlas = charted) => projectWildsAtlas({
    center: shelter.position, zoom: "region", missionProgress: 0, worldMastery: 0, discoveredLandmarkIds: [],
    selfId: owner, viewerOwnerId: owner, players: [], explorationAtlas, structures: Object.values(world.structures)
  });
  const ownerMap = atlas(founded.projection, FOUNDER);
  const explorerMap = atlas(explorerView, RESIDENT);
  assert.deepEqual(ownerMap.worldAdditions, explorerMap.worldAdditions);
  assert.equal(explorerMap.worldAdditions[0]?.id, shelter.structureId);
  assert.equal(explorerView.revision, viewerBefore.revision);
  assert.equal(Object.values(explorerView.cities ?? {})[0]?.name, "Juniper Reach");
  assert.deepEqual(Object.values(explorerView.cities ?? {})[0]?.cells, command.cells);
  assert.equal(wildsCityPopulation(Object.values(explorerView.cities ?? {})[0]!), 1);
  const uncharted = { ...charted, rows: [] };
  assert.equal(atlas(explorerView, RESIDENT, uncharted).worldAdditions.length, 0);

  const city = Object.values(explorerView.cities ?? {})[0]!;
  const resident = WildsWorldService.fromLocalProjection(explorerView);
  const membership = execute(resident, {
    type: "city.residency.request", cityId: city.id, expectedRevision: city.revision, expectedHead: city.head,
    rulesDigest: WILDS_CITY_RULES_DIGEST, commandId: "atlas:proof:residency"
  }, RESIDENT, founded.events[0]!.uPulse + 2);
  const updated = applyWildsAtlasCivicEvent(civics, membership.events[0]!, `${RESIDENT}.receiz.id`);
  const founderReceives = mergeWildsAtlasSource(founded.projection, { buildings, civics: updated });
  assert.ok(founderReceives.cities?.[city.id]?.applications[RESIDENT]);
  assert.equal(founderReceives.cursor, founded.projection.cursor);
  assert.deepEqual(founderReceives.cities?.[city.id]?.history[0], city.history[0]);
});
