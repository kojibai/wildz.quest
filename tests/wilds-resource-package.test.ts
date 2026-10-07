import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { createWildsNourishmentState, gatherWildsNourishment, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from "../src/features/play/wilds-nourishment";
import { createWildsResourcePackage, verifyWildsResourcePackage } from "../src/features/play/wilds-resource-package";
import { initialWildsWorldProjection,checkpointWildsWorld } from "../src/features/play/wilds-world-state";
import { applyWildsResourcePackageCommand } from "../src/features/play/wilds-resource-package-world";
import { preserveWildsResourcePackageHistory } from "../src/features/play/wilds-resource-package-continuity";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import {createKaiTemporalRoot} from "../src/features/play/kai-temporal-root";
import {deriveKaiKlokMomentFromUPulse} from "../src/features/play/kai-klok-moment";

const owner = "sender.receiz.id";
function fixtures() {
  const source = [-2,-1,0,1,2].flatMap(x => [-2,-1,0,1,2].flatMap(z => projectWildsResourceRegion(x,z))).find(s => s.kind === "timber")!;
  const materialLot = createWildsMaterialHarvest({source,current:initialWildsHarvestedSourceState(source),ownerReceizId:owner,actorPosition:source.position,kaiUPulse:100}).lot;
  const plant = wildsNourishmentPlantsForTile(3,3)[0]!;
  const gathered = gatherWildsNourishment({state:createWildsNourishmentState(owner),ownerReceizId:owner,sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,undefined,100).head,kaiUPulse:100,player:plant.position,spaceId:"wildz.space.outer.v1"});
  assert.equal(gathered.ok,true); if (!gathered.ok) throw Error("fixture");
  const packageProof = createWildsResourcePackage({ownerReceizId:owner,createdKaiUPulse:100,commandId:"package:one",members:[{kind:"material",id:materialLot.lotId,materialLot},{kind:"food",id:gathered.item.itemId,foodItem:gathered.item,nourishment:gathered.state}]});
  return {materialLot,gathered,packageProof,world:{...initialWildsWorldProjection(),materialLots:{[materialLot.lotId]:materialLot}}};
}

describe("resource packages",()=>{
  it("binds exact mixed contents and finite food evidence",()=>{
    const {packageProof}=fixtures(); assert.equal(verifyWildsResourcePackage(packageProof),true);
    assert.equal(verifyWildsResourcePackage({...packageProof,members:[...packageProof.members].reverse()}),false);
    assert.throws(()=>createWildsResourcePackage({...packageProof,commandId:"bad",members:[packageProof.members[0]!,packageProof.members[0]!]}),/duplicate/);
  });
  it("reserves members before a claim and only unpacks once",()=>{
    const {packageProof,materialLot,world}=fixtures();
    const packed={...world,...applyWildsResourcePackageCommand(world,{type:"resource.package.create",package:packageProof,commandId:"package:one"},owner)};
    assert.equal(packed.reservedMaterialLots[materialLot.lotId],packageProof.packageId);
    assert.throws(()=>applyWildsResourcePackageCommand(packed,{type:"resource.package.create",package:createWildsResourcePackage({...packageProof,commandId:"package:two"}),commandId:"package:two"},owner),/unavailable/);
    const unpacked={...packed,...applyWildsResourcePackageCommand(packed,{type:"resource.package.unpack",packageId:packageProof.packageId,commandId:"unpack:one"},owner)};
    assert.equal(unpacked.reservedMaterialLots[materialLot.lotId],undefined);
    assert.equal(unpacked.resourcePackages![packageProof.packageId]!.status,"unpacked");
    assert.throws(()=>applyWildsResourcePackageCommand(unpacked,{type:"resource.package.begin-transfer",packageId:packageProof.packageId,commandId:"send:one"},owner),/unavailable/);
    const stale=preserveWildsResourcePackageHistory(unpacked,packed);
    assert.equal(stale.resourcePackages![packageProof.packageId]!.status,"unpacked");
    assert.equal(stale.reservedMaterialLots[materialLot.lotId],undefined);
  });
  it("replays the same exact resource intent across retry times and rejects changed sources",()=>{
    const {packageProof,world}=fixtures(),service=new WildsWorldService({checkpoint:checkpointWildsWorld(world)});
    const authority={actorId:owner,canonical:true,pulse:"2026-10-07T12:00:00.000Z",occurredAt:"2026-10-07T12:00:00.000Z",uPulse:100};
    const kai=(uPulse:number)=>createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({uPulse,authority:"world"}));
    const command={type:"resource.package.create" as const,package:packageProof,commandId:packageProof.commandId};
    assert.equal(service.execute({...command,kai:kai(100)},authority).events.length,1);
    assert.equal(service.execute({...command,kai:kai(101)},{...authority,uPulse:101}).events.length,0);
    const changed=createWildsResourcePackage({...packageProof,createdKaiUPulse:101});
    assert.throws(()=>service.execute({...command,package:changed,kai:kai(102)},{...authority,uPulse:102}),/command_conflict/);
  });
  it("can cancel a provably pre-instrument attempt while retaining the package member lock",()=>{
    const {packageProof,materialLot,world}=fixtures();
    const packed={...world,...applyWildsResourcePackageCommand(world,{type:"resource.package.create",package:packageProof,commandId:"package:one"},owner)};
    const issuing={...packed,...applyWildsResourcePackageCommand(packed,{type:"resource.package.begin-transfer",packageId:packageProof.packageId,targetHandle:null,commandId:"package:send"},owner)};
    assert.equal(issuing.resourcePackages![packageProof.packageId]!.transferProtocol,"plan-before-issue-v1");
    const restored={...issuing,...applyWildsResourcePackageCommand(issuing,{type:"resource.package.abort-transfer",packageId:packageProof.packageId,transferId:null,commandId:"package:abort"},owner)};
    assert.equal(restored.resourcePackages![packageProof.packageId]!.status,"packed");
    assert.equal(restored.reservedMaterialLots[materialLot.lotId],packageProof.packageId);
  });
});
