import assert from "node:assert/strict";
import {test} from "node:test";
import * as burrow from "../src/features/play/wilds-burrow";
import {admitWildsDiscoveryPhysicalNeighborhood} from "../src/features/play/wilds-discovery-sites";
test("burrow planner produces a safe grid-aligned entrance and rejects disconnected rooms",()=>{
  const physical=admitWildsDiscoveryPhysicalNeighborhood(0,0);
  const preview=burrow.previewWildsBurrow({},physical,{kind:"entrance",pointer:{x:20,z:20},heading:0,depth:2},"owner");
  assert.equal(preview.blocker,null);
  assert.equal(preview.from.x,20);
  assert.equal(preview.to.z,24);
  assert.equal(preview.to.y,preview.from.y-2);
  assert.match(burrow.previewWildsBurrow({},physical,{kind:"room",pointer:{x:20,z:20},heading:0,depth:0},"owner").blocker ?? "",/existing/);
});

import {sealCollectedCard} from "../src/features/play/portable-card";
import {creatureForms} from "../src/features/play/creature-catalog";
import {WildsWorldService} from "../src/features/play/wilds-world-service";
import {checkpointWildsWorld} from "../src/features/play/wilds-world-state";
import {mergeWildsConstructionPersistence,projectWildsConstructionPersistence} from "../src/features/play/wilds-construction-persistence";
import {prepareWildsSiteRuntime,enterWildsSiteRuntime} from "../src/features/play/wilds-site-runtime";
const owner="owner";
const card=(()=>{
  for(const form of creatureForms.filter(form=>form.stage===1))for(let i=0;i<64;i++){
    const candidate=sealCollectedCard({capturedAt:"2026-09-08T12:00:00.000Z",encounterId:`dig-${form.id}-${i}`,formId:form.id,ownerReceizId:owner});
    if(burrow.wildsCreatureCanDig(candidate))return candidate;
  }
  throw new Error("digging fixture unavailable");
})();
test("digging admits connected rooms, restores the same world and cannot use another player's creature",()=>{
  assert.ok(card,"catalog contains a digging creature");
  const service=new WildsWorldService();
  const physical=admitWildsDiscoveryPhysicalNeighborhood(0,0);
  const request={kind:"entrance" as const,pointer:{x:20,z:20},heading:0,depth:2};
  const p=burrow.previewWildsBurrow({},physical,request,owner);
  const authority={actorId:owner,canonical:true,card,occurredAt:"2026-09-08T12:00:00.000Z",pulse:"2026-09-08T12:00:00.000Z",uPulse:10};
  const command={type:"construction.burrow.dig" as const,request,actorPosition:p.from,cardProofDigest:card.proof.digest,commandId:"burrow:1"};
  service.execute(command,authority);
  const first=Object.values(service.snapshot().burrows!)[0];
  assert.ok(first);
  const room={...request,kind:"room" as const,parentId:first.id,pointer:first.to,heading:1,depth:0};
  service.execute({...command,request:room,actorPosition:first.to,commandId:"burrow:2"},{...authority,uPulse:11});
  const world=service.snapshot(),proofs=world.burrows!;
  assert.equal(Object.keys(proofs).length,2);
  assert.deepEqual(new WildsWorldService({checkpoint:checkpointWildsWorld(world)}).snapshot(),world);
  assert.deepEqual(burrow.admitWildsBurrows(JSON.parse(JSON.stringify(proofs))),proofs);
  assert.deepEqual(projectWildsConstructionPersistence(world,owner).burrows,proofs);
  assert.deepEqual(mergeWildsConstructionPersistence({},world).burrows,proofs);
  const composed=burrow.composeWildsBurrowPhysical(physical,proofs);
  assert.equal(burrow.composeWildsBurrowPhysical(physical,proofs),composed,"warmed projection is stable");
  const runtime=prepareWildsSiteRuntime(composed),entered=enterWildsSiteRuntime(runtime,burrow.wildsBurrowSiteKey(first.id),first.from);
  assert.ok(entered);
  assert.ok(burrow.restoreWildsBurrowSpace(entered,proofs));
  const before=checkpointWildsWorld(world);
  service.execute(command,authority);
  assert.deepEqual(checkpointWildsWorld(service.snapshot()),before);
  assert.throws(()=>service.execute({...command,commandId:"foreign:dig"},{...authority,actorId:"other"}));
  assert.deepEqual(checkpointWildsWorld(service.snapshot()),before);
});

test("the composed underground preview agrees with admission and walking stays on the dug route",async()=>{
  const {writeWildsSiteRuntimeMovement}=await import("../src/features/play/wilds-site-runtime");
  const physical=admitWildsDiscoveryPhysicalNeighborhood(0,0);
  const request={kind:"entrance" as const,pointer:{x:20,z:20},heading:0,depth:2};
  const first=burrow.createWildsBurrow({burrows:{},request,ownerReceizId:owner,creature:card,commandId:"walk:entrance",kaiUPulse:1,actorPosition:burrow.previewWildsBurrow({},physical,request,owner).from});
  const map={[first.id]:first},composed=burrow.composeWildsBurrowPhysical(physical,map);
  const extension={...request,kind:"tunnel" as const,parentId:first.id,pointer:first.to,depth:0};
  assert.deepEqual(burrow.previewWildsBurrow(map,composed,extension,owner),burrow.previewWildsBurrow(map,physical,extension,owner));
  const runtime=prepareWildsSiteRuntime(composed),space=enterWildsSiteRuntime(runtime,burrow.wildsBurrowSiteKey(first.id),first.from)!;
  let point={...space.position};
  const output={x:0,z:0,floorY:0,ceilingY:0,surfaceId:null as string|null,flooded:false,blocked:false,blockedByClimb:false};
  for(let i=0;i<40;i++){
    writeWildsSiteRuntimeMovement(output,runtime,space.spaceId,point.x,point.y,point.z,point.x,point.z+.1,.2);
    point={x:output.x,y:output.floorY,z:output.z};
  }
  assert.ok(point.z>=first.to.z-.2,`walk stopped at ${JSON.stringify(point)}`);
  assert.ok(Math.abs(point.y-first.to.y)<.3);
  const saved={...space,position:point,surfaceId:output.surfaceId};
  assert.ok(burrow.restoreWildsBurrowSpace(saved,map));
  writeWildsSiteRuntimeMovement(output,runtime,space.spaceId,point.x,point.y,point.z,point.x+5,point.z,.2);
  assert.ok(output.blocked);
});

test("room floors admit underground builds while solid cave walls reject oversize placements",async()=>{
  const {previewWildsContinuousBuild}=await import("../src/features/play/wilds-continuous-builder");
  const {initialWildsWorldProjection}=await import("../src/features/play/wilds-world-state");
  const physical=admitWildsDiscoveryPhysicalNeighborhood(0,0);
  const request={kind:"entrance" as const,pointer:{x:20,z:20},heading:0,depth:2};
  const root=burrow.createWildsBurrow({burrows:{},request,ownerReceizId:owner,creature:card,commandId:"room:entrance",kaiUPulse:1,actorPosition:burrow.previewWildsBurrow({},physical,request,owner).from});
  const room=burrow.createWildsBurrow({burrows:{[root.id]:root},request:{...request,kind:"room",parentId:root.id,pointer:root.to,depth:0},ownerReceizId:owner,creature:card,commandId:"room:chamber",kaiUPulse:2,actorPosition:root.to});
  const world={...initialWildsWorldProjection(),burrows:{[root.id]:root,[room.id]:room}};
  const built=previewWildsContinuousBuild(world,owner,"foundation",{pointer:room.to,rotationQuarterTurns:0,heightStep:0,surfaceSnap:true,spaceId:`wildz.burrow.space.v1:${root.id}`});
  assert.equal(built.placement.valid,true,JSON.stringify(built.placement.cues));
  const narrow=previewWildsContinuousBuild(world,owner,"foundation",{...built.request,pointer:root.from});
  assert.equal(narrow.placement.valid,false);
  const service=new WildsWorldService({checkpoint:checkpointWildsWorld(world)});
  const authority={actorId:owner,canonical:true,occurredAt:"2026-09-08T12:00:00.000Z",pulse:"2026-09-08T12:00:00.000Z",uPulse:10};
  service.execute({type:"construction.project.create",name:"Underground home",region:{x:0,z:0},commandId:"underground:project"},authority);
  const preview=previewWildsContinuousBuild(service.snapshot(),owner,"foundation",built.request);
  service.execute({type:"construction.component.place",projectId:preview.project!.projectId,placement:preview.placement,request:preview.request,actorPosition:room.to,commandId:"underground:foundation"},authority);
  const component=Object.values(service.snapshot().constructionComponents)[0];
  const {createWildsMaterialContribution,createWildsWorkContribution}=await import("../src/features/play/wilds-construction-component");
  const {sealConstructionProof}=await import("../src/features/play/wilds-construction-project");
  let index=0;
  const materials=component.recipe.stages.flatMap(stage=>(["hay","timber","stone"] as const).flatMap(kind=>Array.from({length:stage.materials[kind]},()=>{
    const lot=sealConstructionProof({schema:"wildz.material-lot.v1" as const,lotId:`wildz:material:${kind}:${(++index).toString(16).padStart(64,"0")}`,kind,quantity:1 as const,quality:1 as const,ownerReceizId:owner,source:{sourceId:"source:test",sourceHead:`sha256:${"a".repeat(64)}`,admittedSourceHead:`sha256:${"b".repeat(64)}`,kaiUPulse:1},contributors:{explorerReceizId:owner},authority:"source-proof-object" as const});
    return createWildsMaterialContribution({component,lot,custodianReceizId:owner,contributorReceizId:owner,commandId:`underground:deposit:${index}`,kaiUPulse:11});
  })));
  const work=createWildsWorkContribution({component,materials,worker:{kind:"player",receizId:owner},amount:20,commandId:"underground:work",kaiUPulse:12});
  const finished={...service.snapshot(),constructionMaterialContributions:Object.fromEntries(materials.map(m=>[m.contributionId,m])),constructionWorkContributions:{[work.contributionId]:work}};
  const {composeWildsInteriorConstruction,projectWildsConstructionObstacles}=await import("../src/features/play/wilds-construction-physics");
  const {projectWildsStructureSupports}=await import("../src/features/play/wilds-structure-support");
  assert.equal(projectWildsConstructionObstacles(finished).length,0,"underground solids never obstruct the exterior");
  assert.equal(projectWildsStructureSupports(finished).length,0,"underground decks never lift the exterior player");
  const physicalBuilt=composeWildsInteriorConstruction(burrow.composeWildsBurrowPhysical(physical,world.burrows),finished);
  const deck=physicalBuilt.surfaces.find(s=>s.id.startsWith("wildz.support.component:"))!;
  assert.ok(deck,"completed foundation has an interior support");
  const entered=enterWildsSiteRuntime(prepareWildsSiteRuntime(physicalBuilt),burrow.wildsBurrowSiteKey(root.id),root.from)!;
  const standing={...entered,position:deck.center,surfaceId:deck.id};
  assert.equal(burrow.restoreWildsBurrowSpace(standing,world.burrows,p=>composeWildsInteriorConstruction(p,finished))?.surfaceId,deck.id);
});

test("admitted immutable burrow sources are reused; changed serialized sources are rejected",()=>{
  const physical=admitWildsDiscoveryPhysicalNeighborhood(0,0),request={kind:"entrance" as const,pointer:{x:20,z:20},heading:0,depth:2};
  const source=burrow.createWildsBurrow({burrows:{},request,ownerReceizId:owner,creature:card,commandId:"cache:entrance",kaiUPulse:1,actorPosition:burrow.previewWildsBurrow({},physical,request,owner).from});
  assert.equal(burrow.admitWildsBurrows({[source.id]:source})[source.id],source);
  const modified=JSON.parse(JSON.stringify(source));modified.to.y-=1;
  assert.equal(Object.keys(burrow.admitWildsBurrows({[source.id]:modified})).length,0);
});
