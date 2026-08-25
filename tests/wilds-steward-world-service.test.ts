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
  createWildsTrailBridge,
  createWildsTrailShelter,
  initialWildsHarvestedSourceState,
  projectWildsCreatureWorkFamilies
} from "../src/features/play/wilds-steward-construction";
import { admitWildsEmission, previewWildsEmission } from "../src/features/play/wilds-world-emission";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import { projectWildsRenderedLivingObstacles } from "../src/features/play/wilds-terrain-obstacles";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";

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

describe("shared-world steward commands", () => {
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
});
