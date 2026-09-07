import { wildsWorldSourceEmission } from "../src/features/play/wilds-world-genesis";
import assert from "node:assert/strict";
import { test } from "node:test";
import { constructionProofDigest } from "../src/features/play/wilds-construction-project";
import { WildsWorldService, type WildsWorldCommand } from "../src/features/play/wilds-world-service";
import { checkpointWildsWorld, initialWildsWorldProjection } from "../src/features/play/wilds-world-state";
import { createWildsWorkstation, createWildsStewardStructureOperation, createWildsStewardTool, createWildsStewardToolOperation, playerStewardBuilder, type WildsMaterialLotV1 } from "../src/features/play/wilds-steward-construction";
import { completeWildsConstructionSite } from "../src/features/play/wilds-construction-site";
import { createWildsWorldEmissionGenesis } from "../src/features/play/wilds-world-emission";
import { settleWildsBuild } from "../src/features/play/wilds-steward-build-settlement";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import { worldCommandRequiresCard } from "../src/features/play/wilds-world-authority";
import { previewWildsContinuousBuild } from "../src/features/play/wilds-continuous-builder";
import { projectWildsStewardCraft } from "../src/features/play/wilds-steward-craft";
import { missingBuildMaterials } from "../src/features/play/wilds-build-guidance";
import { sha256PortableBasis } from "../src/features/play/portable-card";
const actorId = "player:builder";
const position = { x: 2, z: 2 };
const authority = { actorId, canonical: true, pulse: "2026-09-07T00:00:00.000Z", occurredAt: "2026-09-07T00:00:00.000Z", uPulse: 10 };
function lot(index: number, kind: "timber" | "stone"): WildsMaterialLotV1 {
  const basis = { schema: "wildz.material-lot.v1" as const, lotId: `wildz:material:${kind}:${index.toString(16).padStart(64, "0")}`, kind, quantity: 1 as const, quality: 1 as const, ownerReceizId: actorId, source: { sourceId: "source:test", sourceHead: sha256PortableBasis("source"), admittedSourceHead: sha256PortableBasis("harvest"), kaiUPulse: 1 }, contributors: { explorerReceizId: actorId }, authority: "source-proof-object" as const };
  return { ...basis, head: constructionProofDigest(basis) };
}
function fixture(noReward: boolean) {
  const lots = [lot(1,"timber"),lot(2,"timber"),lot(3,"timber"),lot(4,"stone"),lot(5,"stone"),lot(6,"timber"),lot(7,"stone")];
  const state = initialWildsWorldProjection();
  const worldEmission = noReward ? createWildsWorldEmissionGenesis({ epochId: "test:empty", epochEndsAtKaiUPulse: 1000, globalCapacityPhiMicro: "0", regionCapacityPhiMicro: { "region:0:0": "0" }, classCapacityPhiMicro: { construction: "0" }, policyDigest: sha256PortableBasis("policy") }) : wildsWorldSourceEmission(state);
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld({ ...state, materialLots: Object.fromEntries(lots.map(l => [l.lotId,l])), worldEmission }) });
  return { service, lots };
}
for (const noReward of [false, true]) test(`player builds workbench and crafts axe without a companion (empty reward budget: ${noReward})`, () => {
  const { service, lots } = fixture(noReward);
  const buildLots = lots.slice(0,5);
  const builder = playerStewardBuilder(actorId);
  const workstation = createWildsWorkstation({ ownerReceizId: actorId, position: { ...position, y: sampleWildsTerrain(position.x,position.z).elevation }, rotationQuarterTurns: 0, lots: buildLots, builder, existingStructures: [], kaiUPulse: 10 });
  const operation = createWildsStewardStructureOperation({ structure: workstation, lots: buildLots, ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId) });
  assert.equal(operation.participants.some(p => p.kind === "creature"), false);
  const settlement = settleWildsBuild({ operation, currentEmission: wildsWorldSourceEmission(service.snapshot()), actorId });
  const command: WildsWorldCommand = { type: "structure.steward-workbench.build", position, actorPosition: position, rotationQuarterTurns: 0, lotIds: buildLots.map(l => l.lotId), ...settlement, commandId: "build:workbench" };
  assert.equal(worldCommandRequiresCard(command), false);
  const before = service.snapshot();
  assert.throws(() => service.execute({ ...command, actorPosition: { x: 100, z: 100 } }, authority), /unreachable/);
  assert.deepEqual(service.snapshot(), before);
  assert.throws(() => service.execute({ ...command, amountPhiMicro: "999999" }, authority), /economy_mismatch/);
  assert.deepEqual(service.snapshot(), before);
  service.execute(command, authority);
  assert.deepEqual(service.snapshot().structures[workstation.structureId]?.builder, builder);
  if (noReward) {
    assert.equal(settlement.amountPhiMicro, "0");
    assert.equal(service.snapshot().worldEmission?.head, before.worldEmission?.head);
    assert.equal(Object.keys(service.snapshot().stewardPhiAwards).length, 0);
  } else assert.ok(BigInt(settlement.amountPhiMicro) > 0n);
  const toolLots = lots.slice(5);
  const tool = createWildsStewardTool({ kind: "steward-axe", ownerReceizId: actorId, workstation, lots: toolLots, builder, kaiUPulse: 11 });
  const toolOperation = createWildsStewardToolOperation({ tool, lots: toolLots, workstation, ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId) });
  service.execute({ type: "tool.steward.craft", kind: "steward-axe", workstationId: workstation.structureId, actorPosition: position, lotIds: toolLots.map(l=>l.lotId), ...settleWildsBuild({ operation: toolOperation, currentEmission: wildsWorldSourceEmission(service.snapshot()), actorId }), commandId: "craft:axe" }, { ...authority, uPulse: 11 });
  assert.ok(service.snapshot().stewardTools[tool.toolId]);
  const restored = new WildsWorldService({ checkpoint: service.checkpoint(), events: service.events() });
  assert.deepEqual(restored.snapshot(), service.snapshot());
  assert.throws(() => restored.execute({ ...command, commandId: "build:spend-again" }, authority), /material_invalid/);
});
test("a funded shelter finishes with player labour and no workbench or reward capacity", () => {
  const { service, lots } = fixture(true);
  service.execute({ type: "construction.site.place", blueprint: "trail-shelter", position, actorPosition: position, rotationQuarterTurns: 0, lotIds: [lots[0]!.lotId,lots[1]!.lotId,lots[4]!.lotId], commandId: "site:place" }, authority);
  const site = Object.values(service.snapshot().constructionSites)[0]!;
  const siteLots = site.contributedLots.map(l=>service.snapshot().materialLots[l.lotId]!);
  const completed = completeWildsConstructionSite({ site, lots: siteLots, workerReceizId: actorId, existingStructures: [], kaiUPulse: 11 });
  const operation = createWildsStewardStructureOperation({ structure: completed.structure, lots: siteLots, ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId) });
  service.execute({ type: "construction.site.work", siteId: site.siteId, siteHead: site.head, actorPosition: position, ...settleWildsBuild({ operation, currentEmission: wildsWorldSourceEmission(service.snapshot()), actorId }), commandId: "site:finish" }, { ...authority, uPulse: 11 });
  assert.equal(service.snapshot().constructionSites[site.siteId]?.stage,"complete");
  assert.equal(Object.keys(service.snapshot().reservedMaterialLots).length,0);
  assert.equal(Object.keys(service.snapshot().consumedMaterialLots).length,3);
});
test("all funded blueprints are available even with no gathering companion", () => {
  const { lots } = fixture(false);
  const projection = projectWildsStewardCraft({ activeCreatureName: "", materialLots: lots, pending: false, selectedBlueprintId: null, workMeters: [] });
  assert.ok(projection.blueprints.every(b => b.state === "ready"));
  assert.equal(missingBuildMaterials({ timber: 3, stone: 2 }, { timber: 3, stone: 1 }), "1 stone");
});
test("piece workbench starts on dry ground without a foundation, but cannot float", () => {
  const state = initialWildsWorldProjection();
  const request = { pointer: { ...position, y: sampleWildsTerrain(position.x,position.z).elevation }, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true };
  const valid = previewWildsContinuousBuild(state,actorId,"workshop",request);
  assert.equal(valid.placement.valid,true,valid.placement.cues.join(","));
  const lifted = previewWildsContinuousBuild(state,actorId,"workshop",{ ...request,heightStep: 2 });
  assert.equal(lifted.placement.valid,false);
  assert.ok(lifted.placement.cues.includes("needs-terrain-support"));
  assert.equal(previewWildsContinuousBuild(state,actorId,"workshop",{ ...request,surfaceSnap:false }).placement.valid,false);
});
