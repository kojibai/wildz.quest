import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { creatureForm } from "../src/features/play/creature-catalog";
import { createWildsCreatureMandate, evaluateWildsCreatureConsent } from "../src/features/play/wilds-creature-mandate";
import { sealCollectedCard, sha256PortableBasis, type PortableCardAsset } from "../src/features/play/portable-card";
import { projectWildsResourceRegion, type WildsResourceSource } from "../src/features/play/wilds-resource-authority";
import { initialWildsHarvestedSourceState, projectWildsCreatureWorkFamilies } from "../src/features/play/wilds-steward-construction";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import { projectWildsRenderedLivingObstacles } from "../src/features/play/wilds-terrain-obstacles";

const actorId = "player:steward";
const baseUPulse = 1_000_000;
const timestamp = "2026-08-24T12:00:00.000Z";

function card(formId: string, ordinal: string) {
  return sealCollectedCard({ capturedAt: timestamp, encounterId: `steward-${ordinal}`, formId, ownerReceizId: actorId });
}

function sourceOf(kind: "timber" | "stone") {
  for (let x = -12; x <= 12; x += 1) for (let z = -12; z <= 12; z += 1) {
    const source = projectWildsResourceRegion(x, z).find((candidate) => candidate.kind === kind);
    if (source) return source;
  }
  throw new Error(`missing_${kind}`);
}

function mandate(asset: PortableCardAsset, professions: readonly string[], allowedResourceIds: readonly string[], uPulse: number) {
  const creatureSubjectId = `creature:${sha256PortableBasis(asset.id).slice(0, 32)}`;
  const creatureHead = sha256PortableBasis(asset.proof.digest);
  const regionSource = allowedResourceIds.length ? [sourceOf(allowedResourceIds[0]!.includes(":stone:") ? "stone" : "timber")] : [];
  const region = regionSource.length ? { x: regionSource[0]!.regionX, z: regionSource[0]!.regionZ } : { x: 0, z: 0 };
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
  return service.execute({
    type: "resource.material.harvest",
    source,
    sourceHead: current.head,
    actorPosition: { x: source.position.x, z: source.position.z },
    mandate: mandate(asset, [profession], [source.sourceId], uPulse),
    cardProofDigest: asset.proof.digest,
    commandId: `command:material:${ordinal}`
  }, { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse, card: asset });
}

describe("shared-world steward commands", () => {
  it("admits exact source lots, consumes them once, and restores the structure from checkpoint", () => {
    const service = new WildsWorldService();
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
    const result = service.execute({
      type: "structure.trail-shelter.build",
      position,
      actorPosition: position,
      rotationQuarterTurns: 0,
      lotIds,
      mandate: mandate(groveCard, ["build"], [], baseUPulse + 3),
      cardProofDigest: groveCard.proof.digest,
      commandId: "command:shelter:1"
    }, { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 3, card: groveCard });
    const structure = Object.values(result.projection.structures)[0]!;
    assert.equal(structure.stage, "complete");
    assert.equal(Object.keys(result.projection.consumedMaterialLots).length, 3);
    const shelterObstacles = projectWildsRenderedLivingObstacles(result.projection).filter((obstacle) => obstacle.id.includes(structure.structureId));
    assert.equal(shelterObstacles.length, 4);
    assert.equal(shelterObstacles.every((obstacle) => obstacle.shape.kind === "cylinder" && obstacle.airbornePolicy === "clearable"), true);
    assert.throws(() => service.execute({
      type: "structure.trail-shelter.build",
      position: { x: position.x + 20, z: position.z },
      actorPosition: { x: position.x + 20, z: position.z },
      rotationQuarterTurns: 0,
      lotIds,
      mandate: mandate(groveCard, ["build"], [], baseUPulse + 4),
      cardProofDigest: groveCard.proof.digest,
      commandId: "command:shelter:replay-spend"
    }, { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: baseUPulse + 4, card: groveCard }), /structure_material_invalid/);
    const recovered = new WildsWorldService({ checkpoint: service.checkpoint(), events: service.events() });
    assert.deepEqual(recovered.snapshot().structures, service.snapshot().structures);
  });

  it("rejects a stale source head and a card whose affinity cannot perform the work", () => {
    const service = new WildsWorldService();
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
});
