import { createWildsConstructionSite, contributeWildsConstructionSite } from "../src/features/play/wilds-construction-site";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState, type WildsMaterialLotV1 } from "../src/features/play/wilds-steward-construction";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { canonicalPortableCardJson, sha256PortableBasis } from "../src/features/play/portable-card";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWildsConstructionProject, createWildsConstructionChunk, appendWildsConstructionChunkReference, appendWildsConstructionProjectChunk, constructionProofDigest } from "../src/features/play/wilds-construction-project";
import { createWildsConstructionComponent, createWildsMaterialContribution, createWildsWorkContribution, verifyWildsMaterialContribution, verifyWildsWorkContribution } from "../src/features/play/wilds-construction-component";
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement } from "../src/features/play/wilds-world-construction";
import { createWildsWorldEvent, type WildsWorldEventKind } from "../src/features/play/wilds-world-event";
import { initialWildsWorldProjection, reduceWildsWorldEvent, checkpointWildsWorld, replayWildsWorld, projectWildsConstructionProgressFromWorld, type WildsWorldProjection, type WildsWorldCheckpoint } from "../src/features/play/wilds-world-state";
const digest = constructionProofDigest;
function continuousEvent(world: WildsWorldProjection, kind: WildsWorldEventKind, payload: object, causeId: string, actorId = "owner") {
 return createWildsWorldEvent({ kind, payload: {...payload,commandDigest:digest({causeId})}, causeId, actorId, pulse:"2026-08-26T00:00:00.000Z", occurredAt:"2026-08-26T00:00:00.000Z", uPulse:10, kaiKlok:world.revision+1, previousEventId:world.cursor?.eventId??null });
}
function fixture() {
 const project = createWildsConstructionProject({ownerReceizId:"owner",name:"Test",region:{x:0,z:0},kaiUPulse:1,commandId:"project:1"});
 let world=initialWildsWorldProjection(); const created=continuousEvent(world,"construction.project_created",{project},"project:1"); world=reduceWildsWorldEvent(world,created);
 const evidence={sourceBlueprint:createWildsBlueprintPreview("blueprint:test","wildz.excavation.region.v1:0:0"),pointer:{x:2,y:0,z:2},rotationQuarterTurns:0,heightStep:0,physical:{terrainY:0,waterline:null,anchors:[],solids:[]}};
 const component=createWildsConstructionComponent({project,evidence,placement:previewWildsBlueprintPlacement({blueprint:evidence.sourceBlueprint,kind:"foundation",...evidence}),ownerReceizId:"owner",kaiUPulse:2,commandId:"place:1"});
 const {chunk}=appendWildsConstructionChunkReference({chunk:createWildsConstructionChunk({project,kaiUPulse:2}),component,kaiUPulse:2});
 const successor=appendWildsConstructionProjectChunk({project,chunk,kaiUPulse:2});
 const placed=continuousEvent(world,"construction.component_placed",{component,chunk,project:successor},"place:1");
 return {world,component,placed,created,project,chunk};
}
function material(index:number) {
 const basis={schema:"wildz.material-lot.v1" as const,lotId:`wildz:material:stone:${index.toString(16).padStart(64,"0")}`,kind:"stone" as const,quantity:1 as const,quality:1 as const,ownerReceizId:"owner",source:{sourceId:"source:test",sourceHead:`sha256:${"a".repeat(64)}`,admittedSourceHead:`sha256:${"b".repeat(64)}`,kaiUPulse:1},contributors:{explorerReceizId:"owner"},authority:"source-proof-object" as const};return {...basis,head:digest(basis)};
}
it("places atomically with no lots and preserves exact durable command receipts",()=>{
 const f=fixture();const placed=reduceWildsWorldEvent(f.world,f.placed);assert.equal(placed.constructionComponents[f.component.componentId].head,f.component.head);assert.deepEqual(placed.reservedMaterialLots,{});
 const restored=replayWildsWorld([],checkpointWildsWorld(placed));assert.equal(reduceWildsWorldEvent(restored,f.placed),restored);
 const conflict=continuousEvent(restored,"construction.component_placed",{...f.placed.payload,component:{...f.component,ownerReceizId:"guest"}},"place:1");assert.throws(()=>reduceWildsWorldEvent(restored,conflict),/command_conflict/);
 const before=JSON.stringify(checkpointWildsWorld(f.world));assert.throws(()=>reduceWildsWorldEvent(f.world,continuousEvent(f.world,"construction.component_placed",{component:f.component,chunk:f.chunk},"place:1")));assert.equal(JSON.stringify(checkpointWildsWorld(f.world)),before);
});
it("reserves exact deposits and consumes newly embedded lots with player work",()=>{
 const f=fixture();let world=reduceWildsWorldEvent(f.world,f.placed);const lots=[material(1),material(2)]; world={...world,materialLots:Object.fromEntries(lots.map(l=>[l.lotId,l]))};
 const contributions=lots.map(lot=>createWildsMaterialContribution({component:f.component,lot,custodianReceizId:"owner",contributorReceizId:"owner",commandId:"deposit:1",kaiUPulse:3}));
 world=reduceWildsWorldEvent(world,continuousEvent(world,"construction.material_contributed",{contributions},"deposit:1"));assert.equal(world.reservedMaterialLots[lots[0].lotId],f.component.componentId);
 assert.throws(()=>reduceWildsWorldEvent(world,continuousEvent(world,"construction.material_contributed",{contributions},"deposit:2")));
 const contribution=createWildsWorkContribution({component:f.component,materials:contributions,worker:{kind:"player",receizId:"owner"},amount:1,commandId:"work:1",kaiUPulse:4});
 world=reduceWildsWorldEvent(world,continuousEvent(world,"construction.work_contributed",{contribution},"work:1"));assert.equal(projectWildsConstructionProgressFromWorld(world,f.component.componentId).stage,"framed");for(const lot of lots){assert.equal(world.consumedMaterialLots[lot.lotId],f.component.componentId);assert.equal(world.reservedMaterialLots[lot.lotId],undefined);}
});
it("hydrates missing maps only after verifying legacy checkpoint bytes",()=>{
 const old=initialWildsWorldProjection();for(const key of Object.keys(old).filter(k=>k.startsWith("construction")&&k!=="constructionSites")) delete (old as unknown as Record<string,unknown>)[key];const checkpoint=checkpointWildsWorld(old);const before=JSON.stringify(checkpoint);assert.deepEqual(replayWildsWorld([],checkpoint).constructionComponents,{});assert.equal(JSON.stringify(checkpoint),before);assert.throws(()=>replayWildsWorld([],{...checkpoint,projectionDigest:"sha256:bad"}));
});
it("rejects wrong actors, tampered proofs, disposed lots and unfunded or creature work atomically",()=>{
 const f=fixture();let world=reduceWildsWorldEvent(f.world,f.placed);const lot=material(9);world={...world,materialLots:{[lot.lotId]:lot}};
 const contribution=createWildsMaterialContribution({component:f.component,lot,custodianReceizId:"owner",contributorReceizId:"owner",commandId:"deposit:bad",kaiUPulse:3});
 const snapshot=JSON.stringify(checkpointWildsWorld(world));
 assert.throws(()=>reduceWildsWorldEvent(world,continuousEvent(world,"construction.material_contributed",{contributions:[contribution]},"deposit:bad","guest")));
 for(const map of ["storedMaterialLots","consumedMaterialLots","reservedMaterialLots"] as const) assert.throws(()=>reduceWildsWorldEvent({...world,[map]:{[lot.lotId]:"elsewhere"}},continuousEvent(world,"construction.material_contributed",{contributions:[contribution]},"deposit:bad")));
 assert.throws(()=>reduceWildsWorldEvent(world,continuousEvent(world,"construction.material_contributed",{contributions:[{...contribution,quantity:2}]},"deposit:bad")));
 for(const worker of [{kind:"player" as const,receizId:"owner"},{kind:"creature" as const,receizId:"owner",creatureSubjectId:"creature:one",creatureHead:digest("head")}]) {
 const work=createWildsWorkContribution({component:f.component,worker,amount:1,commandId:"work:bad",kaiUPulse:4});assert.throws(()=>reduceWildsWorldEvent(world,continuousEvent(world,"construction.work_contributed",{contribution:work},"work:bad")));}
 assert.equal(JSON.stringify(checkpointWildsWorld(world)),snapshot);
});
it("later deposits preserve embedded lot identities and checkpoint replay is exact",()=>{
 const f=fixture();let world=reduceWildsWorldEvent(f.world,f.placed);
 const lots=[material(11),material(12),material(13)];world={...world,materialLots:Object.fromEntries(lots.map(l=>[l.lotId,l]))};
 const deposits=lots.map((lot,i)=>createWildsMaterialContribution({component:f.component,lot,custodianReceizId:"owner",contributorReceizId:"owner",commandId:i<2?"deposit:first":"deposit:later",kaiUPulse:3}));
 world=reduceWildsWorldEvent(world,continuousEvent(world,"construction.material_contributed",{contributions:deposits.slice(0,2)},"deposit:first"));
 const work=createWildsWorkContribution({component:f.component,materials:deposits.slice(0,2),worker:{kind:"player",receizId:"owner"},amount:1,commandId:"work:first",kaiUPulse:4});
 world=reduceWildsWorldEvent(world,continuousEvent(world,"construction.work_contributed",{contribution:work},"work:first"));
 const embedded=projectWildsConstructionProgressFromWorld(world,f.component.componentId).embeddedLotIds;
 const checkpoint=checkpointWildsWorld(world);const later=continuousEvent(world,"construction.material_contributed",{contributions:deposits.slice(2)},"deposit:later");const after=reduceWildsWorldEvent(world,later);
 assert.deepEqual(projectWildsConstructionProgressFromWorld(after,f.component.componentId).embeddedLotIds,embedded);assert.deepEqual(after.consumedMaterialLots,world.consumedMaterialLots);assert.deepEqual(replayWildsWorld([later],checkpoint),after);
 const absent=createWildsWorkContribution({component:f.component,materials:deposits.slice(0,2),worker:{kind:"player",receizId:"owner"},amount:1,commandId:"work:absent",kaiUPulse:4});
 const missing=createWildsWorkContribution({component:f.component,materials:deposits,work:[absent],worker:{kind:"player",receizId:"owner"},amount:1,commandId:"work:missing",kaiUPulse:5});
 assert.equal(missing.priorWork[0]?.contributionId,absent.contributionId);
 assert.throws(()=>reduceWildsWorldEvent(after,continuousEvent(after,"construction.work_contributed",{contribution:missing},"work:missing")));
});

const TIME = "2026-08-25T12:00:00.000Z";
const OWNER = "player:builder";
const HELPER = "player:helper";

function lot(kind: "timber" | "stone", ownerReceizId: string, kaiUPulse: number): WildsMaterialLotV1 {
  const source = [-2, -1, 0, 1, 2].flatMap((x) => [-2, -1, 0, 1, 2].flatMap((z) => projectWildsResourceRegion(x, z)))
    .find((candidate) => candidate.kind === kind)!;
  return createWildsMaterialHarvest({
    source,
    current: initialWildsHarvestedSourceState(source),
    ownerReceizId,
    actorPosition: source.position,
    creature: { subjectId: `creature:${ownerReceizId.replaceAll(":", "-")}`, head: `sha256:${"a".repeat(64)}`, workFamilies: [source.requirements.creature], willing: true },
    kaiUPulse
  }).lot;
}

function event(kind: "construction.site_placed" | "construction.site_contributed" | "resource.material_custody_transferred", actorId: string, payload: unknown, previousEventId: string | null, uPulse: number) {
  return createWildsWorldEvent({ kind, actorId, causeId: `command:${uPulse}`, pulse: TIME, occurredAt: TIME, kaiKlok: uPulse, uPulse, previousEventId, payload });
}

describe("construction site world projection", () => {
  it("moves custody by receipt without rewriting the source lot", () => {
    const timber = lot("timber", OWNER, 2_000_000);
    const seeded = { ...initialWildsWorldProjection(), materialLots: { [timber.lotId]: timber } };
    const transfer = event("resource.material_custody_transferred", HELPER, {
      lotId: timber.lotId,
      ownerReceizId: HELPER,
      subjectId: "subject:timber",
      subjectHead: "b".repeat(64),
      receiptId: "receipt:timber",
      transferId: "transfer:timber"
    }, null, 2_000_001);
    const moved = reduceWildsWorldEvent(seeded, transfer);
    assert.equal(moved.materialLots[timber.lotId], timber);
    assert.equal(moved.materialLots[timber.lotId]?.ownerReceizId, OWNER);
    assert.equal(moved.materialCustody[timber.lotId]?.ownerReceizId, HELPER);
  });

  it("places without reserving materials then reserves an exact contributed lot once", () => {
    const timber = lot("timber", HELPER, 2_000_001);
    const site = createWildsConstructionSite({ blueprint: "trail-shelter", placedByReceizId: OWNER, actorPosition: { x: 10, z: 10 }, position: { x: 12, z: 11 }, rotationQuarterTurns: 0, existingStructures: [], existingSites: [], kaiUPulse: 2_000_010 });
    const placedEvent = event("construction.site_placed", OWNER, { site }, null, 2_000_010);
    const seeded = { ...initialWildsWorldProjection(), materialLots: { [timber.lotId]: timber } };
    const placed = reduceWildsWorldEvent(seeded, placedEvent);
    assert.equal(placed.constructionSites[site.siteId]?.head, site.head);
    assert.deepEqual(placed.reservedMaterialLots, {});

    const nextSite = contributeWildsConstructionSite({ site, contributorReceizId: HELPER, lots: [timber], kaiUPulse: 2_000_011 });
    const contributionEvent = event("construction.site_contributed", HELPER, { site: nextSite }, placedEvent.eventId, 2_000_011);
    const contributed = reduceWildsWorldEvent(placed, contributionEvent);
    assert.equal(contributed.constructionSites[site.siteId]?.head, nextSite.head);
    assert.equal(contributed.reservedMaterialLots[timber.lotId], site.siteId);
    assert.throws(() => reduceWildsWorldEvent({ ...placed, consumedMaterialLots: { [timber.lotId]: "other" } }, contributionEvent), /material_invalid/);
  });

  it("hydrates exact legacy V3 checkpoints with empty construction maps", () => {
    const checkpoint = checkpointWildsWorld(initialWildsWorldProjection());
    const legacyProjection = { ...checkpoint.projection } as Partial<typeof checkpoint.projection>;
    delete legacyProjection.constructionSites;
    delete legacyProjection.reservedMaterialLots;
    const legacy = {
      ...checkpoint,
      projection: legacyProjection,
      projectionDigest: sha256PortableBasis(canonicalPortableCardJson(legacyProjection))
    } as unknown as WildsWorldCheckpoint;
    const restored = replayWildsWorld([], legacy);
    assert.deepEqual(restored.constructionSites, {});
    assert.deepEqual(restored.reservedMaterialLots, {});
  });
});
it("rejects a sealed page that drops a causal reference",()=>{
 const f=fixture();const world=reduceWildsWorldEvent(f.world,f.placed);const project=world.constructionProjects[f.project.projectId];
 const component=createWildsConstructionComponent({project,evidence:f.component.evidence,placement:f.component.placement,ownerReceizId:"owner",kaiUPulse:3,commandId:"place:second"});
 const {chunk}=appendWildsConstructionChunkReference({chunk:world.constructionChunks[f.chunk.chunkId],component,kaiUPulse:3});
 const {head:_,...basis}=chunk;const altered={...basis,references:chunk.references.filter(r=>r.componentId===component.componentId)};const forged={...altered,head:digest(altered)};
 const before=JSON.stringify(checkpointWildsWorld(world));assert.throws(()=>reduceWildsWorldEvent(world,continuousEvent(world,"construction.component_placed",{component,chunk:forged},"place:second")));assert.equal(JSON.stringify(checkpointWildsWorld(world)),before);
 const next=reduceWildsWorldEvent(world,continuousEvent(world,"construction.component_placed",{component,chunk},"place:second"));assert.equal(next.constructionChunks[chunk.chunkId].references.length,2);
});

it("rejects correctly sealed material that predates its component without changing checkpoint bytes", () => {
  const f = fixture();
  const placed = reduceWildsWorldEvent(f.world, f.placed);
  const lot = material(91);
  const world = { ...placed, materialLots: { [lot.lotId]: lot } };
  const contribution = createWildsMaterialContribution({ component: f.component, lot, custodianReceizId: "owner", contributorReceizId: "owner", commandId: "deposit:backdated", kaiUPulse: 3 });
  const { head: _, ...basis } = contribution;
  const backdatedBasis = { ...basis, kaiUPulse: f.component.kaiUPulse - 1 };
  const backdated = { ...backdatedBasis, head: digest(backdatedBasis) };
  assert.equal(verifyWildsMaterialContribution(backdated), true);
  const before = JSON.stringify(checkpointWildsWorld(world));
  assert.throws(() => reduceWildsWorldEvent(world, continuousEvent(world, "construction.material_contributed", { contributions: [backdated] }, "deposit:backdated")), /transition_invalid/);
  assert.equal(JSON.stringify(checkpointWildsWorld(world)), before);
  assert.equal(world.reservedMaterialLots[lot.lotId], undefined);
  assert.equal(world.constructionCommandReceipts["deposit:backdated"], undefined);
});

it("rejects correctly sealed funded work that predates its component atomically", () => {
  const f = fixture();
  let world = reduceWildsWorldEvent(f.world, f.placed);
  const lots = [material(92), material(93)];
  world = { ...world, materialLots: Object.fromEntries(lots.map(lot => [lot.lotId, lot])) };
  const contributions = lots.map(lot => createWildsMaterialContribution({ component: f.component, lot, custodianReceizId: "owner", contributorReceizId: "owner", commandId: "deposit:funded", kaiUPulse: 3 }));
  world = reduceWildsWorldEvent(world, continuousEvent(world, "construction.material_contributed", { contributions }, "deposit:funded"));
  const contribution = createWildsWorkContribution({ component: f.component, materials: contributions, worker: { kind: "player", receizId: "owner" }, amount: 1, commandId: "work:backdated", kaiUPulse: 4 });
  const { head: _, ...basis } = contribution;
  const backdatedBasis = { ...basis, kaiUPulse: f.component.kaiUPulse - 1 };
  const backdated = { ...backdatedBasis, head: digest(backdatedBasis) };
  assert.equal(verifyWildsWorkContribution(backdated), true);
  const before = JSON.stringify(checkpointWildsWorld(world));
  assert.throws(() => reduceWildsWorldEvent(world, continuousEvent(world, "construction.work_contributed", { contribution: backdated }, "work:backdated")), /transition_invalid/);
  assert.equal(JSON.stringify(checkpointWildsWorld(world)), before);
});
