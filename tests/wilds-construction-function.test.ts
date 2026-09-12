import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import assert from "node:assert/strict";
import { it } from "node:test";
import { constructionProofDigest, createWildsConstructionProject } from "../src/features/play/wilds-construction-project";
import { createWildsConstructionComponent, createWildsMaterialContribution, createWildsWorkContribution, projectWildsConstructionProgress } from "../src/features/play/wilds-construction-component";
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement } from "../src/features/play/wilds-world-construction";
import { resolveWildsConstructionFunction, verifyWildsConstructionFunctionSource } from "../src/features/play/wilds-construction-function";
import { createWildsStewardTool, createWildsStewardToolOperation, createWildsStewardPhiAward, reviseWildsStewardToolAfterUse, verifyWildsStewardTool, type WildsMaterialLotV1 } from "../src/features/play/wilds-steward-construction";
import { initialWildsWorldProjection, reduceWildsWorldEvent } from "../src/features/play/wilds-world-state";
import { createWildsWorldEvent, type WildsWorldEventKind } from "../src/features/play/wilds-world-event";
import { wildsWorldSourceEmission } from "../src/features/play/wilds-world-genesis";
import { admitWildsEmission, previewWildsEmission } from "../src/features/play/wilds-world-emission";
import { sha256PortableBasis } from "../src/features/play/portable-card";
function lot(index: number, kind: WildsMaterialLotV1["kind"]): WildsMaterialLotV1 {
  const basis = { schema: "wildz.material-lot.v1" as const, lotId: `wildz:material:${kind}:${index.toString(16).padStart(64,"0")}`, kind, quantity: 1 as const, quality: 1 as const, ownerReceizId: "owner", source: { sourceId: "source:test", sourceHead: `sha256:${"a".repeat(64)}`, admittedSourceHead: `sha256:${"b".repeat(64)}`, kaiUPulse: 1 }, contributors: { explorerReceizId: "owner" }, authority: "source-proof-object" as const };
  return { ...basis, head: constructionProofDigest(basis) };
}
function fixture(kind: "workshop" | "storage" | "bed", amount: number) {
  const project = createWildsConstructionProject({ ownerReceizId: "owner", name: "Functions", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const base = createWildsBlueprintPreview("blueprint:test", "wildz.excavation.region.v1:0:0");
  const foundation = previewWildsBlueprintPlacement({ blueprint: base, kind: "foundation", pointer: { x: 2, y: 0, z: 2 }, rotationQuarterTurns: 0, heightStep: 0, physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } });
  const evidence = { sourceBlueprint: { ...base, pieces: [foundation] }, pointer: { x: 2, y: .6, z: 2 }, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true, physical: { terrainY: 0, waterline: null, anchors: foundation.anchors, solids: foundation.collisionSolids } };
  const component = createWildsConstructionComponent({ project, evidence, placement: previewWildsBlueprintPlacement({ blueprint: evidence.sourceBlueprint, kind, ...evidence }), ownerReceizId: "owner", kaiUPulse: 2 });
  let index = 0;
  const lots = component.recipe.stages.flatMap(stage => (["hay", "timber", "stone"] as const).flatMap(k => Array.from({length: stage.materials[k]}, () => lot(++index, k))));
  const materials = lots.map(lot => createWildsMaterialContribution({ component, lot, custodianReceizId: "owner", contributorReceizId: "owner", commandId: `deposit:${lot.lotId}`, kaiUPulse: 3 }));
  const work = [createWildsWorkContribution({ component, materials, worker: { kind: "player", receizId: "owner" }, amount, commandId: "work:1", kaiUPulse: 4 })];
  const progress = projectWildsConstructionProgress(component, materials, work);
  const world = { ...initialWildsWorldProjection(), constructionComponents: { [component.componentId]: component }, materialLots: Object.fromEntries(lots.map(l => [l.lotId,l])), constructionMaterialContributions: Object.fromEntries(materials.map(p => [p.contributionId,p])), constructionWorkContributions: Object.fromEntries(work.map(p => [p.contributionId,p])), consumedMaterialLots: Object.fromEntries(progress.embeddedLotIds.map(id => [id,component.componentId])) };
  return { world, component };
}
let eventSequence = 0;
const event = (kind: WildsWorldEventKind, payload: object, previousEventId: string | null = null) => createWildsWorldEvent({ kind, payload, causeId: `command:${kind}:${++eventSequence}`, actorId: "owner", pulse: "2026-09-07T00:00:00.000Z", occurredAt: "2026-09-07T00:00:00.000Z", uPulse: 10, kaiKlok: previousEventId ? 2 : 1, previousEventId });
it("enables only funded functional or finished component functions with exact evidence", () => {
  for (const kind of ["workshop", "storage"] as const) {
    const framed = fixture(kind, 1); assert.equal(resolveWildsConstructionFunction(framed.world, framed.component.componentId, kind), null);
    for (const amount of [kind === "workshop" ? 3 : 2, kind === "workshop" ? 4 : 3]) {
      const {world, component} = fixture(kind, amount); const source = resolveWildsConstructionFunction(world, component.componentId, kind)!; assert.ok(source);
      assert.equal(verifyWildsConstructionFunctionSource({...source, work: []}, kind), false);
      assert.equal(verifyWildsConstructionFunctionSource({...source, materials: source.materials.slice(1)}, kind), false);
      assert.equal(resolveWildsConstructionFunction({...world, consumedMaterialLots: {}}, component.componentId, kind), null);
    }
  }
});
it("crafts, admits, equips and uses an exact workshop tool without consuming construction lots twice", () => {
  const {world,component} = fixture("workshop",3); const workstation = resolveWildsConstructionFunction(world,component.componentId,"workshop")!;
  const lots = [lot(101,"timber"),lot(102,"stone")]; Object.assign(world.materialLots,Object.fromEntries(lots.map(l=>[l.lotId,l])));
  const tool = createWildsStewardTool({kind:"steward-axe",ownerReceizId:"owner",workstation,lots,builder:{creatureSubjectId:"creature:test",creatureHead:`sha256:${"a".repeat(64)}`},kaiUPulse:10});
  const operation = createWildsStewardToolOperation({tool,lots,workstation,ownerReceizId:"owner",playerHead:sha256PortableBasis("owner")});
  const currentEmission = wildsWorldSourceEmission(world); const preview = previewWildsEmission({emission:currentEmission,operation,contributionClass:"construction"});
  const emission = admitWildsEmission({emission:currentEmission,operation,contributionClass:"construction",preview});
  const phiAward = createWildsStewardPhiAward({ownerReceizId:"owner",operation,currentEmission,nextEmission:emission,amountPhiMicro:preview.amountPhiMicro});
  const crafted = reduceWildsWorldEvent(world,event("tool.crafted",{tool,operation,emission,phiAward,amountPhiMicro:preview.amountPhiMicro}));
  assert.equal(crafted.consumedMaterialLots[lots[0].lotId],tool.toolId); for(const [id,owner] of Object.entries(world.consumedMaterialLots)) assert.equal(crafted.consumedMaterialLots[id],owner);
  const equipped = reduceWildsWorldEvent(crafted,event("tool.equipped",{toolId:tool.toolId},crafted.cursor!.eventId)); assert.equal(equipped.equippedStewardTools.owner,tool.toolId);
  const used = reviseWildsStewardToolAfterUse(tool,{capability:"lumber",kaiUPulse:11}); assert.equal(used.parentHead,tool.head); assert.equal(used.durability.remaining,23); assert.ok(verifyWildsStewardTool(used));
});
it("deposits and withdraws exact storage lots and rejects reserved material", () => {
  const {world,component} = fixture("storage",2); const material = lot(110,"stone"); world.materialLots[material.lotId]=material;
  const payload={lotId:material.lotId,cacheId:component.componentId,direction:"deposit"};
  const stored=reduceWildsWorldEvent(world,event("storage.material_moved",payload)); assert.equal(stored.storedMaterialLots[material.lotId],component.componentId);
  assert.throws(()=>reduceWildsWorldEvent(stored,event("storage.material_moved",payload)));
  const withdrawn=reduceWildsWorldEvent(stored,event("storage.material_moved",{...payload,direction:"withdraw"},stored.cursor!.eventId)); assert.equal(withdrawn.storedMaterialLots[material.lotId],undefined);
  assert.throws(()=>reduceWildsWorldEvent({...world,reservedMaterialLots:{[material.lotId]:component.componentId}},event("storage.material_moved",payload)));
});

it("a bed is usable only after exact construction materials and work make it functional", () => {
  const pending = fixture("bed", 1);
  assert.equal(resolveWildsConstructionFunction(pending.world, pending.component.componentId, "bed"), null);
  const finished = fixture("bed", 100);
  const source = resolveWildsConstructionFunction(finished.world, finished.component.componentId, "bed");
  assert.ok(source);
  assert.equal(verifyWildsConstructionFunctionSource(source, "bed"), true);
  assert.equal(verifyWildsConstructionFunctionSource(source, "storage"), false);
  const missing = { ...finished.world, consumedMaterialLots: {} };
  assert.equal(resolveWildsConstructionFunction(missing, finished.component.componentId, "bed"), null);
});

it("resting in a completed nearby bed restores more energy and rejects distant or unfinished beds", () => {
  const { world, component } = fixture("bed", 100);
  const bed = resolveWildsConstructionFunction(world, component.componentId, "bed")!;
  const state = { ...structuredClone(initialPlayState), energy: 10, player: { x: bed.position.x, z: bed.position.z } };
  state.siteSpace = { ...state.siteSpace, position: { ...state.siteSpace.position, y: bed.position.y } };
  assert.equal(applyWildsInput(state, { type: "rest" }).energy, 45);
  assert.equal(applyWildsInput(state, { type: "rest", bed }).energy, 65);
  const distant = { ...state, player: { x: 100, z: 100 } };
  assert.equal(applyWildsInput(distant, { type: "rest", bed }), distant);
  assert.equal(applyWildsInput(state, { type: "rest", bed: { ...bed, work: [] } }), state);
});
