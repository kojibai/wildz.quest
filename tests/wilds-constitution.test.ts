import assert from "node:assert/strict";
import { test } from "node:test";
import { mayOwn, validAcquisition, originalStanding, verifyPermission, evaluateFruit, evaluateExternalities, deriveResponsibility, punishableOmission, mayRepresentAsEstablished, publicClaimStatus, guardianScope, verifyEmergency, verifyDefense, verifyCompletion, verifySuccession, mayAbandon, scarcityRecord, coerciveDependency, validAmendment, WILDS_CONSTITUTION } from "../src/features/play/wilds-constitution";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import { initialWildsWorldProjection, checkpointWildsWorld } from "../src/features/play/wilds-world-state";
import { exportWildsConstitutionalProof, verifyWildsConstitutionalProof } from "../src/features/play/wilds-constitutional-proof";

// Each vector keeps its source facts and expected conclusion in the test, independent of implementation output.
const fruit = { baseline: "forest:healthy", result: "forest:healthy", attributable: true, evidence: ["ecology:observation"], beneficial: true, preservesThreatenedState: true, basis: "CONSERVATION" };
const authority = { actorId: "person:alice", canonical: true, occurredAt: "2026-09-07T12:00:00.000Z", pulse: "2026-09-07T12:00:00.000Z", uPulse: 10 };
test("CV-001 Founder confiscation cannot acquire another person's tool", () => { assert.equal(validAcquisition("FOUNDER", false, false, false), false); });
test("CV-002 Majority vote without jurisdiction cannot transfer ownership", () => { assert.equal(validAcquisition("MAJORITY_VOTE", false, false, false), false); });
test("CV-003 Voluntary sale needs both predecessor and transfer authority", () => { assert.equal(validAcquisition("VOLUNTARY_TRANSFER", true, true, false), true); assert.equal(validAcquisition("VOLUNTARY_TRANSFER", false, true, false), false); });
test("CV-004 Possession does not establish title", () => { assert.equal(validAcquisition("POSSESSION", true, false, false), false); });
test("CV-005 Fraud challenge never silently rewrites historical disposition", () => { assert.equal(publicClaimStatus("DISPUTED"), "DISPUTED"); assert.equal(mayRepresentAsEstablished("DISPUTED"), false); });
test("CV-006 Price appreciation is not fruit or instant abandonment", () => { assert.equal(evaluateFruit({...fruit, result: "price:up", basis: "PRICE_APPRECIATION"}), false); assert.equal(mayAbandon({state:"ACTIVE",objectiveIndicators:true,predicatesComplete:true,provenWrongfulInterference:false}), false); });
test("CV-007 Conservation needs no revenue", () => { assert.equal(evaluateFruit(fruit), true); assert.equal(evaluateFruit({...fruit,evidence:[]}), false); });
test("CV-008 Production cannot cancel pollution", () => { assert.deepEqual(evaluateExternalities(["goods"],["water-contamination"]), {fruit:["goods"],unauthorizedHarm:["water-contamination"]}); });
test("CV-009 Guardianship is never ownership of a person", () => { assert.equal(mayOwn({type:"PERSON",sourceClass:"BIOLOGICAL"}), false); });
test("CV-010 Returned capacity contracts guardian scope", () => { assert.deepEqual(guardianScope(["care","travel"],["travel"]),["care"]); assert.deepEqual(guardianScope(["care"],["care"]),[]); });
test("CV-011 Emergency preservation expires and requires necessity", () => { const rescue={begin:1,expiration:10,at:2,threat:true,necessary:true,evidence:["fire"]}; assert.equal(verifyEmergency(rescue),true); assert.equal(verifyEmergency({...rescue,at:10}),false); assert.equal(verifyEmergency({...rescue,expiration:Infinity}),false); });
test("CV-012 Defense ends with the threat", () => { assert.equal(verifyDefense({ongoingThreat:false,necessary:true,proportionate:true}),false); });
test("CV-013 Intent cannot rewrite responsibility", () => { const source={actor:"A",outcome:"harm",causalLinks:["direct"],causationEstablished:true}; assert.deepEqual(deriveResponsibility({...source,intent:"accidental"}),deriveResponsibility({...source,intent:"intentional"})); });
test("CV-014 Possibility without duty cannot establish punishable omission", () => { assert.equal(punishableOmission({duty:false,knowledge:true,opportunity:true,capacity:true,causation:true}),false); });
test("CV-015 Allegation is not established public truth", () => { assert.equal(mayRepresentAsEstablished("ALLEGED"),false); assert.equal(mayRepresentAsEstablished("ADMITTED"),false); });
test("CV-016 Overturn remains attached to the public record", () => { assert.equal(publicClaimStatus("OVERTURNED"),"OVERTURNED"); assert.equal(mayRepresentAsEstablished("OVERTURNED"),false); });
test("CV-017 Completion cannot automatically regenerate punishment", () => { assert.equal(verifyCompletion({status:"ACTIVE",predicates:[true,true],terminationRule:"repaired"}),"COMPLETED"); assert.equal(verifyCompletion({status:"COMPLETED",predicates:[false],terminationRule:"repaired"}),"COMPLETED"); assert.equal(verifyCompletion({status:"ACTIVE",predicates:[],terminationRule:null}),"UNRESOLVED"); });
test("CV-018 Essential water dependency grants no unrelated rights", () => { assert.equal(coerciveDependency({indispensable:true,unilateralExclusion:true,unrelatedRightsDemanded:true,realisticAlternatives:false}),true); });
test("CV-019 Debt cannot create person ownership", () => { assert.equal(mayOwn({type:"PERSON",sourceClass:"PRODUCED"}),false); assert.equal(validAcquisition("DEBT_BONDAGE",true,true,false),false); });
test("CV-020 AI and founders have no constitutional override", () => { assert.equal(originalStanding({kind:"AI"}),false); assert.equal(validAmendment({predecessor:"v1",current:"v1",authority:true,ratified:true,effects:["machine-sovereignty"]}),false); });
test("CV-021 Incompatible successors remain visible", () => { assert.deepEqual(verifySuccession({current:"v1",predecessor:"v1",proposed:"v2b",candidates:["v2a"],authorized:true}),{result:"FORK",candidates:["v2a","v2b"]}); });
test("CV-022 Stale replay cannot regain current standing", () => { assert.equal(verifySuccession({current:"v2",predecessor:"v1",proposed:"v3",candidates:[],authorized:true}).result,"STALE_PREDECESSOR"); });
test("CV-023 Sabotage cannot manufacture abandonment", () => { assert.equal(mayAbandon({state:"AT_RISK",objectiveIndicators:true,predicatesComplete:true,provenWrongfulInterference:true}),false); });
test("CV-024 Legitimate production is valid independent of price or wealth", () => { assert.equal(evaluateFruit({...fruit,baseline:"raw",result:"goods",basis:"MANUFACTURE",preservesThreatenedState:false}),true); assert.equal(mayOwn({type:"TOOL",sourceClass:"PRODUCED"}),true); });
test("CV-025 Need alone cannot transfer title", () => { assert.equal(validAcquisition("NEED",false,false,false),false); });
test("Earth has stewardship, permission is bounded and revocation is prospective", () => {
  assert.equal(mayOwn({type:"RESOURCE",sourceClass:"EARTH"}),false);
  const standing={id:"standing:a",holder:"A",subject:"tool",allowed:["repair"],begin:0,expiration:20};
  const permission={id:"p",grantor:"A",grantee:"B",subject:"tool",allowed:["repair"],forbidden:[],begin:1,expiration:10,revokedAt:5,basis:standing.id};
  const input={actor:"B",subject:"tool",action:"repair",at:4,standing};
  assert.equal(verifyPermission(permission,input),true); assert.equal(verifyPermission(permission,{...input,at:5}),false);
  assert.equal(verifyPermission({...permission,allowed:["repair","sell"]},input),false);
  assert.deepEqual(scarcityRecord(2,5),{available:2,eligibleNeed:5,unmetDemand:3,scarcity:true});
});
test("all playable commands expose a source-bound rule trace and reject undefined authority", () => {
  const service = new WildsWorldService();
  const result=service.execute({type:"construction.project.create",name:"Home",region:{x:0,z:0},commandId:"project:constitutional"},authority);
  assert.equal(result.constitution.result,"VALID"); assert.ok(result.constitution.rulesApplied.includes("TOB-05/13/59")); assert.ok(result.constitution.successor);
  const before=service.checkpoint();
  assert.throws(()=>service.execute({type:"founder.confiscate",commandId:"founder:test"} as never,authority), /wilds_constitution_action_undefined/);
  assert.deepEqual(service.checkpoint(),before);
});
test("portable decision replay rejects tampered outcome and a different source", () => {
  const source=initialWildsWorldProjection();
  const proof=exportWildsConstitutionalProof(source,{type:"construction.project.create",name:"Home",region:{x:0,z:0},commandId:"project:proof"},authority);
  assert.equal(verifyWildsConstitutionalProof(proof,checkpointWildsWorld(source)).valid,true);
  assert.equal(verifyWildsConstitutionalProof({...proof,decision:{...proof.decision,actor:"founder"}},checkpointWildsWorld(source)).valid,false);
  assert.equal(proof.constitution.sourceDigest,WILDS_CONSTITUTION.sourceDigest);
});
test("outsider squad authority fails before mutation with a challengeable decision", () => {
  const service=new WildsWorldService();
  assert.throws(()=>service.execute({type:"team.squad.assemble",teamId:"missing",eventId:"event:one",playerIds:[],commandId:"squad:test"},authority), (error: unknown) => {
    const failure=error as {decision:{result:string;predicatesFailed:unknown[]}};
    assert.equal(failure.decision.result,"INVALID"); assert.ok(failure.decision.predicatesFailed.length); return true;
  });
  assert.equal(service.snapshot().revision,0);
});
test("checkpoint retains command identity and rejects conflicting intent after event-tail loss", () => {
  const service=new WildsWorldService();
  const command={type:"team.create" as const,name:"Stewards",commandId:"team:durable"};
  service.execute(command,authority);
  const restored=new WildsWorldService({checkpoint:service.checkpoint()});
  assert.equal(restored.execute(command,authority).events.length,0);
  assert.throws(()=>restored.execute({...command,name:"Other team"},authority),/command_conflict/);
  assert.throws(()=>restored.execute(command,{...authority,actorId:"founder"}),/command_conflict/);
});
test("reports preserve alleged status and source while creating no sanction", () => {
  const service=new WildsWorldService();
  const result=service.execute({type:"social.report",subjectId:"person:bob",reason:"Dispute the source of tool transfer alpha",commandId:"report:constitutional"},authority);
  const claims=Object.values(result.projection.constitutionalClaims ?? {});
  assert.equal(claims.length,1); assert.equal(claims[0].status,"ALLEGED"); assert.equal(claims[0].claimant,authority.actorId);
  assert.equal(claims[0].sourceEventId,result.events[0].eventId);
});
