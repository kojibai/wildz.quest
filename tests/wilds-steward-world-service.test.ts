import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { creatureForm } from "../src/features/play/creature-catalog";
import { kaiUPulseToISOString } from "../src/features/play/kai-klok-moment";
import { createWildsCreatureMandate, evaluateWildsCreatureConsent } from "../src/features/play/wilds-creature-mandate";
import { sealCollectedCard, sha256PortableBasis, type PortableCardAsset } from "../src/features/play/portable-card";
import { projectWildsResourceRegion, type WildsResourceSource } from "../src/features/play/wilds-resource-authority";
import {
  createWildsMaterialHarvest,
  createWildsStewardHarvestOperation,
  createWildsStewardPhiAward,
  createWildsStewardStructureOperation,
  createWildsStewardTool,
  createWildsStewardToolOperation,
  createWildsTrailCache,
  createWildsTrailBridge,
  createWildsTrailShelter,
  createWildsWorkstation,
  initialWildsHarvestedSourceState,
  projectWildsCreatureWorkFamilies
} from "../src/features/play/wilds-steward-construction";
import { admitWildsEmission, previewWildsEmission } from "../src/features/play/wilds-world-emission";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import { projectWildsRenderedLivingObstacles } from "../src/features/play/wilds-terrain-obstacles";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import { completeWildsConstructionSite, contributeWildsConstructionSite, createWildsConstructionSite } from "../src/features/play/wilds-construction-site";

const actorId = "player:steward";
const baseUPulse = 1_000_000;
const timestamp = kaiUPulseToISOString(baseUPulse);

function card(formId: string, ordinal: string) {
  return sealCollectedCard({ capturedAt: timestamp, encounterId: `steward-${ordinal}`, formId, ownerReceizId: actorId });
}

function sourceOf(kind: "timber" | "stone") {
  for (let x = -2; x <= 2; x += 1) for (let z = -2; z <= 2; z += 1) {
    const source = projectWildsResourceRegion(x, z).find((candidate) => candidate.kind === kind);
    if (source) return source;
  }
  throw new Error(`missing_${kind}`);
}

function mandate(asset: PortableCardAsset, professions: readonly string[], allowedResourceIds: readonly string[], uPulse: number, explicitRegion?: { x: number; z: number }) {
  const creatureSubjectId = `creature:${sha256PortableBasis(asset.id).slice(0, 32)}`;
  const creatureHead = sha256PortableBasis(asset.proof.digest);
  const regionSource = allowedResourceIds.length ? [sourceOf(allowedResourceIds[0]!.includes(":stone:") ? "stone" : "timber")] : [];
  const region = explicitRegion ?? (regionSource.length ? { x: regionSource[0]!.regionX, z: regionSource[0]!.regionZ } : { x: 0, z: 0 });
  const consent = evaluateWildsCreatureConsent({
    creatureSubjectId,
    creatureHead,
    condition: { energy: 100, fatigue: 0, injury: 0, stress: 0 },
    bond: 70,
    preferences: { professions, avoidHazards: [] },
    capabilities: { professions },
    safety: { risk: 2, hazards: [], supportAvailable: false },
    requested: { professions, maxActions: 8 },
    kaiUPulse: uPulse
  });
  return createWildsCreatureMandate({ consent, creatureSubjectId, creatureHead, region, professions, allowedResourceIds, maxActions: 8, issuedAtKaiUPulse: uPulse, expiresAtKaiUPulse: uPulse + 100 });
}

function harvest(service: WildsWorldService, source: WildsResourceSource, asset: PortableCardAsset, uPulse: number, ordinal: number) {
  const current = service.snapshot().harvestedSources[source.sourceId] ?? initialWildsHarvestedSourceState(source);
  const element = creatureForm(asset.manifest.formId)!.element;
  const profession = projectWildsCreatureWorkFamilies(element)[0]!;
  const creatureSubjectId = `creature:${sha256PortableBasis(asset.id).slice(0, 32)}`;
  const creatureHead = sha256PortableBasis(asset.proof.digest);
  const material = createWildsMaterialHarvest({
    source,
    current,
    ownerReceizId: actorId,
    actorPosition: { x: source.position.x, z: source.position.z },
    creature: { subjectId: creatureSubjectId, head: creatureHead, workFamilies: [profession], willing: true },
    kaiUPulse: uPulse
  });
  const operation = createWildsStewardHarvestOperation({
    source,
    currentSource: current,
    harvestedSource: material.source,
    lot: material.lot,
    ownerReceizId: actorId,
    playerHead: sha256PortableBasis(actorId),
    creatureSubjectId,
    creatureHead,
    kaiUPulse: uPulse
  });
  const currentEmission = service.snapshot().worldEmission!;
  const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
  const nextEmission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
  const award = createWildsStewardPhiAward({ ownerReceizId: actorId, operation, currentEmission, nextEmission, amountPhiMicro: preview.amountPhiMicro });
  return service.execute({
    type: "resource.material.harvest",
    source,
    sourceHead: current.head,
    actorPosition: { x: source.position.x, z: source.position.z },
    mandate: mandate(asset, [profession], [source.sourceId], uPulse),
    operation,
    emission: nextEmission,
    amountPhiMicro: preview.amountPhiMicro,
    phiAward: award,
    cardProofDigest: asset.proof.digest,
    commandId: `command:material:${ordinal}`
  }, { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse, card: asset });
}

function soloHarvest(service: WildsWorldService, source: WildsResourceSource, uPulse: number, ordinal: number) {
  const current = service.snapshot().harvestedSources[source.sourceId] ?? initialWildsHarvestedSourceState(source);
  const material = createWildsMaterialHarvest({
    source,
    current,
    ownerReceizId: actorId,
    actorPosition: source.position,
    kaiUPulse: uPulse
  });
  const operation = createWildsStewardHarvestOperation({
    source,
    currentSource: current,
    harvestedSource: material.source,
    lot: material.lot,
    ownerReceizId: actorId,
    playerHead: sha256PortableBasis(actorId),
    kaiUPulse: uPulse
  });
  const currentEmission = service.snapshot().worldEmission!;
  const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
  const nextEmission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
  const award = createWildsStewardPhiAward({ ownerReceizId: actorId, operation, currentEmission, nextEmission, amountPhiMicro: preview.amountPhiMicro });
  return service.execute({
    type: "resource.material.harvest",
    source,
    sourceHead: current.head,
    actorPosition: source.position,
    operation,
    emission: nextEmission,
    amountPhiMicro: preview.amountPhiMicro,
    phiAward: award,
    commandId: `command:material:solo:${ordinal}`
  }, { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse });
}

describe("shared-world steward commands", () => {
  it("admits baseline tree and stone gathering without a creature, mandate, or card", () => {
    const service = new WildsWorldService();
    service.tickGroves({ pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse, systemActorId: "receiz:pulse" });
    const timber = sourceOf("timber");
    const stone = sourceOf("stone");

    const timberResult = soloHarvest(service, timber, baseUPulse + 1, 1);
    const stoneResult = soloHarvest(service, stone, baseUPulse + 2, 2);
    const lots = Object.values(stoneResult.projection.materialLots);

    assert.equal(lots.length, 2);
    assert.deepEqual(lots.map((lot) => lot.kind).sort(), ["stone", "timber"]);
    assert.equal(lots.every((lot) => lot.contributors.creatureSubjectId === undefined), true);
    assert.equal(Object.keys(stoneResult.projection.stewardPhiAwards).length, 2);
    assert.notEqual(stoneResult.projection.worldEmission?.head, timberResult.projection.worldEmission?.head);
  });

  it("persists place, contribution, and companion work as three causal construction stages", () => {
    const service = new WildsWorldService();
    service.tickGroves({ pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse, systemActorId: "receiz:pulse" });
    const timberSource = sourceOf("timber");
    const stoneSource = sourceOf("stone");
    const groveCard = card("mintcub-1", "site-grove");
    const stoneCard = card("titanseal-1", "site-stone");
    harvest(service, timberSource, groveCard, baseUPulse + 1, 401);
    harvest(service, timberSource, groveCard, baseUPulse + 2, 402);
    harvest(service, stoneSource, stoneCard, baseUPulse + 3, 403);
    const position = { x: timberSource.position.x + 2, z: timberSource.position.z + 2 };
    const expectedSite = createWildsConstructionSite({ blueprint: "trail-shelter", placedByReceizId: actorId, actorPosition: position, position,
      rotationQuarterTurns: 0, existingStructures: [], existingSites: [], kaiUPulse: baseUPulse + 4 });

    const placed = service.execute({ type: "construction.site.place", blueprint: "trail-shelter", position, actorPosition: position,
      rotationQuarterTurns: 0, cardProofDigest: groveCard.proof.digest, commandId: "command:construction:place" },
    { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 4, card: groveCard });
    assert.equal(placed.projection.constructionSites[expectedSite.siteId]?.head, expectedSite.head);
    assert.equal(Object.keys(placed.projection.consumedMaterialLots).length, 0);
    assert.equal(Object.keys(placed.projection.stewardPhiAwards).length, 3);
    const placedRestore = new WildsWorldService({ checkpoint: service.checkpoint(), events: service.events() });
    assert.deepEqual(placedRestore.snapshot().constructionSites, service.snapshot().constructionSites);

    const lotIds = Object.keys(service.snapshot().materialLots).sort();
    const lots = lotIds.map((lotId) => service.snapshot().materialLots[lotId]!);
    const expectedReady = contributeWildsConstructionSite({ site: expectedSite, expectedSiteHead: expectedSite.head, contributorReceizId: actorId, lots, kaiUPulse: baseUPulse + 5 });
    const contributed = service.execute({ type: "construction.site.contribute", siteId: expectedSite.siteId, siteHead: expectedSite.head,
      actorPosition: position, lotIds, cardProofDigest: groveCard.proof.digest, commandId: "command:construction:contribute" },
    { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 5, card: groveCard });
    assert.equal(contributed.projection.constructionSites[expectedSite.siteId]?.head, expectedReady.head);
    assert.equal(Object.keys(contributed.projection.reservedMaterialLots).length, 3);
    assert.equal(Object.keys(contributed.projection.consumedMaterialLots).length, 0);
    assert.equal(Object.keys(contributed.projection.stewardPhiAwards).length, 3);

    const creatureSubjectId = `creature:${sha256PortableBasis(groveCard.id).slice(0, 32)}`;
    const creatureHead = sha256PortableBasis(groveCard.proof.digest);
    const completed = completeWildsConstructionSite({ site: expectedReady, expectedSiteHead: expectedReady.head, lots, workerReceizId: actorId,
      creature: { subjectId: creatureSubjectId, head: creatureHead }, existingStructures: [], kaiUPulse: baseUPulse + 6 });
    const operation = createWildsStewardStructureOperation({ structure: completed.structure, lots, ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId) });
    const currentEmission = service.snapshot().worldEmission!;
    const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
    const emission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
    const phiAward = createWildsStewardPhiAward({ ownerReceizId: actorId, operation, currentEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
    const worked = service.execute({ type: "construction.site.work", siteId: expectedSite.siteId, siteHead: expectedReady.head, actorPosition: position,
      mandate: mandate(groveCard, ["build"], [], baseUPulse + 6, { x: Math.floor(position.x / 128), z: Math.floor(position.z / 128) }),
      operation, emission, amountPhiMicro: preview.amountPhiMicro, phiAward, cardProofDigest: groveCard.proof.digest,
      commandId: "command:construction:work" },
    { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 6, card: groveCard });
    assert.equal(worked.projection.constructionSites[expectedSite.siteId]?.stage, "complete");
    assert.equal(Object.keys(worked.projection.structures).length, 1);
    assert.equal(Object.keys(worked.projection.reservedMaterialLots).length, 0);
    assert.equal(Object.keys(worked.projection.consumedMaterialLots).length, 3);
    assert.equal(Object.keys(worked.projection.stewardPhiAwards).length, 4);
    const completedRestore = new WildsWorldService({ checkpoint: service.checkpoint(), events: service.events() });
    assert.deepEqual(completedRestore.snapshot(), service.snapshot());
  });

  it("admits exact source lots, consumes them once, and restores the structure from checkpoint", () => {
    const service = new WildsWorldService();
    service.tickGroves({ pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse, systemActorId: "receiz:pulse" });
    const timber = sourceOf("timber");
    const stone = sourceOf("stone");
    const groveCard = card("mintcub-1", "grove");
    const stoneCard = card("titanseal-1", "stone");
    harvest(service, timber, groveCard, baseUPulse, 1);
    harvest(service, timber, groveCard, baseUPulse + 1, 2);
    harvest(service, stone, stoneCard, baseUPulse + 2, 3);
    const lotIds = Object.keys(service.snapshot().materialLots);
    assert.equal(lotIds.length, 3);

    const position = { x: timber.position.x + 2, z: timber.position.z + 2 };
    const lots = lotIds.map((lotId) => service.snapshot().materialLots[lotId]!);
    const creatureSubjectId = `creature:${sha256PortableBasis(groveCard.id).slice(0, 32)}`;
    const creatureHead = sha256PortableBasis(groveCard.proof.digest);
    const expectedStructure = createWildsTrailShelter({
      ownerReceizId: actorId,
      position: { x: position.x, y: sampleWildsTerrain(position.x, position.z).elevation, z: position.z },
      rotationQuarterTurns: 0,
      lots,
      builder: { creatureSubjectId, creatureHead },
      existingStructures: [],
      kaiUPulse: baseUPulse + 3
    });
    const operation = createWildsStewardStructureOperation({ structure: expectedStructure, lots, ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId) });
    const currentEmission = service.snapshot().worldEmission!;
    const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
    const nextEmission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
    const phiAward = createWildsStewardPhiAward({ ownerReceizId: actorId, operation, currentEmission, nextEmission, amountPhiMicro: preview.amountPhiMicro });
    const result = service.execute({
      type: "structure.trail-shelter.build",
      position,
      actorPosition: position,
      rotationQuarterTurns: 0,
      lotIds,
      mandate: mandate(groveCard, ["build"], [], baseUPulse + 3, { x: Math.floor(position.x / 128), z: Math.floor(position.z / 128) }),
      operation,
      emission: nextEmission,
      amountPhiMicro: preview.amountPhiMicro,
      phiAward,
      cardProofDigest: groveCard.proof.digest,
      commandId: "command:shelter:1"
    }, { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 3, card: groveCard });
    const structure = Object.values(result.projection.structures)[0]!;
    assert.equal(structure.stage, "complete");
    assert.equal(Object.keys(result.projection.consumedMaterialLots).length, 3);
    assert.equal(Object.keys(result.projection.stewardPhiAwards).length, 4);
    assert.equal(result.projection.contributionHistory.at(-1)?.amountPhiMicro, "80000");
    const shelterObstacles = projectWildsRenderedLivingObstacles(result.projection).filter((obstacle) => obstacle.id.includes(structure.structureId));
    assert.equal(shelterObstacles.length, 4);
    assert.equal(shelterObstacles.every((obstacle) => obstacle.shape.kind === "cylinder" && obstacle.airbornePolicy === "clearable"), true);
    assert.throws(() => service.execute({
      type: "structure.trail-shelter.build",
      position: { x: position.x + 20, z: position.z },
      actorPosition: { x: position.x + 20, z: position.z },
      rotationQuarterTurns: 0,
      lotIds,
      mandate: mandate(groveCard, ["build"], [], baseUPulse + 4, { x: Math.floor((position.x + 20) / 128), z: Math.floor(position.z / 128) }),
      cardProofDigest: groveCard.proof.digest,
      commandId: "command:shelter:replay-spend"
    }, { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 4, card: groveCard }), /structure_material_invalid/);
    const recovered = new WildsWorldService({ checkpoint: service.checkpoint(), events: service.events() });
    assert.deepEqual(recovered.snapshot().structures, service.snapshot().structures);
  });

  it("rejects a stale source head and a card whose affinity cannot perform the work", () => {
    const service = new WildsWorldService();
    service.tickGroves({ pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse, systemActorId: "receiz:pulse" });
    const timber = sourceOf("timber");
    const groveCard = card("mintcub-1", "grove-2");
    const stoneCard = card("titanseal-1", "stone-2");
    harvest(service, timber, groveCard, baseUPulse + 10, 10);
    assert.throws(() => service.execute({
      type: "resource.material.harvest",
      source: timber,
      sourceHead: initialWildsHarvestedSourceState(timber).head,
      actorPosition: timber.position,
      mandate: mandate(groveCard, ["lumber"], [timber.sourceId], baseUPulse + 11),
      cardProofDigest: groveCard.proof.digest,
      commandId: "command:material:stale"
    }, { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 11, card: groveCard }), /source_stale/);
    assert.throws(() => service.execute({
      type: "resource.material.harvest",
      source: timber,
      sourceHead: service.snapshot().harvestedSources[timber.sourceId]!.head,
      actorPosition: timber.position,
      mandate: mandate(stoneCard, ["lumber"], [timber.sourceId], baseUPulse + 12),
      cardProofDigest: stoneCard.proof.digest,
      commandId: "command:material:wrong-affinity"
    }, { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 12, card: stoneCard }), /creature_unqualified/);
  });

  it("atomically admits and restores one exact public trail bridge", () => {
    const service = new WildsWorldService();
    service.tickGroves({ pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse, systemActorId: "receiz:pulse" });
    const timber = sourceOf("timber");
    const stone = sourceOf("stone");
    const groveCard = card("mintcub-1", "bridge-grove");
    const stoneCard = card("titanseal-1", "bridge-stone");
    for (let ordinal = 0; ordinal < 4; ordinal += 1) harvest(service, timber, groveCard, baseUPulse + 20 + ordinal, 20 + ordinal);
    for (let ordinal = 0; ordinal < 2; ordinal += 1) harvest(service, stone, stoneCard, baseUPulse + 24 + ordinal, 24 + ordinal);
    const lots = Object.values(service.snapshot().materialLots);
    const position = { x: -292, z: -289 };
    const creatureSubjectId = `creature:${sha256PortableBasis(groveCard.id).slice(0, 32)}`;
    const creatureHead = sha256PortableBasis(groveCard.proof.digest);
    const expectedStructure = createWildsTrailBridge({
      ownerReceizId: actorId,
      position,
      rotationQuarterTurns: 1,
      lots,
      builder: { creatureSubjectId, creatureHead },
      existingStructures: [],
      kaiUPulse: baseUPulse + 26
    });
    const operation = createWildsStewardStructureOperation({ structure: expectedStructure, lots, ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId) });
    const currentEmission = service.snapshot().worldEmission!;
    const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
    const nextEmission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
    const phiAward = createWildsStewardPhiAward({ ownerReceizId: actorId, operation, currentEmission, nextEmission, amountPhiMicro: preview.amountPhiMicro });
    const before = service.snapshot();
    const result = service.execute({
      type: "structure.trail-bridge.build",
      position,
      actorPosition: position,
      rotationQuarterTurns: 1,
      lotIds: lots.map((lot) => lot.lotId),
      mandate: mandate(groveCard, ["build"], [], baseUPulse + 26, { x: -3, z: -3 }),
      operation,
      emission: nextEmission,
      amountPhiMicro: preview.amountPhiMicro,
      phiAward,
      cardProofDigest: groveCard.proof.digest,
      commandId: "command:bridge:1"
    }, { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 26, card: groveCard });

    assert.equal(Object.values(result.projection.structures).at(-1)?.blueprint, "trail-bridge");
    assert.equal(Object.keys(result.projection.consumedMaterialLots).length, 6);
    assert.equal(result.projection.contributionHistory.at(-1)?.amountPhiMicro, "140000");
    assert.notEqual(result.projection.worldEmission?.head, before.worldEmission?.head);
    const recovered = new WildsWorldService({ checkpoint: service.checkpoint(), events: service.events() });
    assert.deepEqual(recovered.snapshot(), service.snapshot());

    const settled = service.snapshot();
    assert.throws(() => service.execute({
      type: "structure.trail-bridge.build",
      position: { x: position.x + 1, z: position.z },
      actorPosition: position,
      rotationQuarterTurns: 1,
      lotIds: lots.map((lot) => lot.lotId),
      mandate: mandate(groveCard, ["build"], [], baseUPulse + 27, { x: -3, z: -3 }),
      cardProofDigest: groveCard.proof.digest,
      commandId: "command:bridge:replay-spend"
    }, { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 27, card: groveCard }), /structure_material_invalid/);
    assert.deepEqual(service.snapshot(), settled);
  });

  it("crafts, equips, and atomically spends one tool durability revision", () => {
    const service = new WildsWorldService();
    service.tickGroves({ pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse, systemActorId: "receiz:pulse" });
    const timber = sourceOf("timber");
    const stone = sourceOf("stone");
    const groveCard = card("mintcub-1", "tool-grove");
    const stoneCard = card("titanseal-1", "tool-stone");
    for (let ordinal = 0; ordinal < 4; ordinal += 1) harvest(service, timber, groveCard, baseUPulse + 40 + ordinal, 40 + ordinal);
    for (let ordinal = 0; ordinal < 3; ordinal += 1) harvest(service, stone, stoneCard, baseUPulse + 44 + ordinal, 44 + ordinal);
    const timberLots = Object.values(service.snapshot().materialLots).filter((lot) => lot.kind === "timber");
    const stoneLots = Object.values(service.snapshot().materialLots).filter((lot) => lot.kind === "stone");
    const position = { x: timber.position.x + 2, z: timber.position.z + 2 };
    const buildLots = [...timberLots.slice(0, 3), ...stoneLots.slice(0, 2)];
    const creatureSubjectId = `creature:${sha256PortableBasis(groveCard.id).slice(0, 32)}`;
    const creatureHead = sha256PortableBasis(groveCard.proof.digest);
    const workstation = createWildsWorkstation({ ownerReceizId: actorId, position: { ...position, y: sampleWildsTerrain(position.x, position.z).elevation }, rotationQuarterTurns: 0,
      lots: buildLots, builder: { creatureSubjectId, creatureHead }, existingStructures: [], kaiUPulse: baseUPulse + 47 });
    const buildOperation = createWildsStewardStructureOperation({ structure: workstation, lots: buildLots, ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId) });
    const buildPreview = previewWildsEmission({ emission: service.snapshot().worldEmission!, operation: buildOperation, contributionClass: "construction" });
    const buildEmission = admitWildsEmission({ emission: service.snapshot().worldEmission!, operation: buildOperation, contributionClass: "construction", preview: buildPreview });
    const buildAward = createWildsStewardPhiAward({ ownerReceizId: actorId, operation: buildOperation, currentEmission: service.snapshot().worldEmission!, nextEmission: buildEmission, amountPhiMicro: buildPreview.amountPhiMicro });
    service.execute({ type: "structure.steward-workbench.build", position, actorPosition: position, rotationQuarterTurns: 0, lotIds: buildLots.map((lot) => lot.lotId),
      mandate: mandate(groveCard, ["build"], [], baseUPulse + 47, { x: Math.floor(position.x / 128), z: Math.floor(position.z / 128) }), operation: buildOperation,
      emission: buildEmission, amountPhiMicro: buildPreview.amountPhiMicro, phiAward: buildAward, cardProofDigest: groveCard.proof.digest, commandId: "command:workbench:1" },
    { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 47, card: groveCard });

    const toolLots = [timberLots[3]!, stoneLots[2]!];
    const tool = createWildsStewardTool({ kind: "steward-axe", ownerReceizId: actorId, workstation, lots: toolLots,
      builder: { creatureSubjectId, creatureHead }, kaiUPulse: baseUPulse + 48 });
    const toolOperation = createWildsStewardToolOperation({ tool, lots: toolLots, workstation, ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId) });
    const toolPreview = previewWildsEmission({ emission: service.snapshot().worldEmission!, operation: toolOperation, contributionClass: "construction" });
    const toolEmission = admitWildsEmission({ emission: service.snapshot().worldEmission!, operation: toolOperation, contributionClass: "construction", preview: toolPreview });
    const toolAward = createWildsStewardPhiAward({ ownerReceizId: actorId, operation: toolOperation, currentEmission: service.snapshot().worldEmission!, nextEmission: toolEmission, amountPhiMicro: toolPreview.amountPhiMicro });
    service.execute({ type: "tool.steward.craft", kind: "steward-axe", workstationId: workstation.structureId, actorPosition: position,
      lotIds: toolLots.map((lot) => lot.lotId), mandate: mandate(groveCard, ["craft"], [], baseUPulse + 48, { x: Math.floor(position.x / 128), z: Math.floor(position.z / 128) }),
      operation: toolOperation, emission: toolEmission, amountPhiMicro: toolPreview.amountPhiMicro, phiAward: toolAward,
      cardProofDigest: groveCard.proof.digest, commandId: "command:tool:craft" },
    { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 48, card: groveCard });
    service.execute({ type: "tool.steward.equip", toolId: tool.toolId, commandId: "command:tool:equip" },
      { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 49 });
    assert.equal(service.snapshot().equippedStewardTools[actorId], tool.toolId);
    assert.equal(service.snapshot().stewardTools[tool.toolId]?.durability.remaining, 24);
    const currentSource = service.snapshot().harvestedSources[timber.sourceId]!;
    const equipped = service.snapshot().stewardTools[tool.toolId]!;
    const material = createWildsMaterialHarvest({ source: timber, current: currentSource, ownerReceizId: actorId, actorPosition: timber.position,
      creature: { subjectId: creatureSubjectId, head: creatureHead, workFamilies: ["lumber"], willing: true }, tool: equipped, kaiUPulse: baseUPulse + 50 });
    const harvestOperation = createWildsStewardHarvestOperation({ source: timber, currentSource, harvestedSource: material.source, lot: material.lot,
      ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId), creatureSubjectId, creatureHead, tool: equipped, nextTool: material.tool, kaiUPulse: baseUPulse + 50 });
    const harvestPreview = previewWildsEmission({ emission: service.snapshot().worldEmission!, operation: harvestOperation, contributionClass: "construction" });
    const harvestEmission = admitWildsEmission({ emission: service.snapshot().worldEmission!, operation: harvestOperation, contributionClass: "construction", preview: harvestPreview });
    const harvestAward = createWildsStewardPhiAward({ ownerReceizId: actorId, operation: harvestOperation, currentEmission: service.snapshot().worldEmission!, nextEmission: harvestEmission, amountPhiMicro: harvestPreview.amountPhiMicro });
    service.execute({ type: "resource.material.harvest", source: timber, sourceHead: currentSource.head, actorPosition: timber.position, toolId: tool.toolId,
      mandate: mandate(groveCard, ["lumber"], [timber.sourceId], baseUPulse + 50), operation: harvestOperation, emission: harvestEmission,
      amountPhiMicro: harvestPreview.amountPhiMicro, phiAward: harvestAward, cardProofDigest: groveCard.proof.digest, commandId: "command:tool:harvest" },
    { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 50, card: groveCard });
    assert.equal(service.snapshot().stewardTools[tool.toolId]?.durability.remaining, 23);
    assert.equal(Object.values(service.snapshot().materialLots).at(-1)?.quality, Math.min(5, timber.quality + 1));
    const recovered = new WildsWorldService({ checkpoint: service.checkpoint(), events: service.events() });
    assert.deepEqual(recovered.snapshot().stewardTools, service.snapshot().stewardTools);
    assert.deepEqual(recovered.snapshot().equippedStewardTools, service.snapshot().equippedStewardTools);
  });

  it("stores and withdraws an exact unconsumed lot only at an owned cache", () => {
    const service = new WildsWorldService();
    service.tickGroves({ pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse, systemActorId: "receiz:pulse" });
    const timber = sourceOf("timber");
    const stone = sourceOf("stone");
    const groveCard = card("mintcub-1", "cache-grove");
    const stoneCard = card("titanseal-1", "cache-stone");
    for (let ordinal = 0; ordinal < 3; ordinal += 1) harvest(service, timber, groveCard, baseUPulse + 60 + ordinal, 60 + ordinal);
    for (let ordinal = 0; ordinal < 2; ordinal += 1) harvest(service, stone, stoneCard, baseUPulse + 63 + ordinal, 63 + ordinal);
    const allLots = Object.values(service.snapshot().materialLots);
    const cacheLots = [...allLots.filter((lot) => lot.kind === "timber").slice(0, 2), ...allLots.filter((lot) => lot.kind === "stone").slice(0, 2)];
    const looseLot = allLots.find((lot) => !cacheLots.includes(lot))!;
    const position = { x: timber.position.x + 2, z: timber.position.z + 2 };
    const creatureSubjectId = `creature:${sha256PortableBasis(groveCard.id).slice(0, 32)}`;
    const creatureHead = sha256PortableBasis(groveCard.proof.digest);
    const cache = createWildsTrailCache({ ownerReceizId: actorId, position: { ...position, y: sampleWildsTerrain(position.x, position.z).elevation }, rotationQuarterTurns: 0,
      lots: cacheLots, builder: { creatureSubjectId, creatureHead }, existingStructures: [], kaiUPulse: baseUPulse + 65 });
    const operation = createWildsStewardStructureOperation({ structure: cache, lots: cacheLots, ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId) });
    const preview = previewWildsEmission({ emission: service.snapshot().worldEmission!, operation, contributionClass: "construction" });
    const emission = admitWildsEmission({ emission: service.snapshot().worldEmission!, operation, contributionClass: "construction", preview });
    const award = createWildsStewardPhiAward({ ownerReceizId: actorId, operation, currentEmission: service.snapshot().worldEmission!, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
    service.execute({ type: "structure.trail-cache.build", position, actorPosition: position, rotationQuarterTurns: 0, lotIds: cacheLots.map((lot) => lot.lotId),
      mandate: mandate(groveCard, ["build"], [], baseUPulse + 65, { x: Math.floor(position.x / 128), z: Math.floor(position.z / 128) }), operation, emission,
      amountPhiMicro: preview.amountPhiMicro, phiAward: award, cardProofDigest: groveCard.proof.digest, commandId: "command:cache:build" },
    { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 65, card: groveCard });
    service.execute({ type: "storage.material.move", lotId: looseLot.lotId, cacheId: cache.structureId, direction: "deposit", actorPosition: position, commandId: "command:cache:deposit" },
      { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 66 });
    assert.equal(service.snapshot().storedMaterialLots[looseLot.lotId], cache.structureId);
    assert.throws(() => service.execute({ type: "storage.material.move", lotId: looseLot.lotId, cacheId: cache.structureId, direction: "deposit", actorPosition: position, commandId: "command:cache:duplicate" },
      { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 67 }), /already_stored/);
    service.execute({ type: "storage.material.move", lotId: looseLot.lotId, cacheId: cache.structureId, direction: "withdraw", actorPosition: position, commandId: "command:cache:withdraw" },
      { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 68 });
    assert.equal(service.snapshot().storedMaterialLots[looseLot.lotId], undefined);
  });
});
