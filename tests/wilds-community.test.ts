import assert from "node:assert/strict";
import { test } from "node:test";
import { transitionCommunity, COMMUNITY_RULES_DIGEST, type CommunityRequest, type WildsCommunity } from "../src/features/play/wilds-community";
import { KAI_N_DAY_MICRO } from "../src/features/play/kai-klok-moment";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
const day = Number(KAI_N_DAY_MICRO);
function setup() {
  let state: WildsCommunity | undefined; let serial = 0;
  const run = (actor: string, action: string, fields: Record<string,string> = {}, at = 0) => {
    const request: CommunityRequest = { expectedActor: actor, action, communityId: "grove-community", expectedRevision: state?.revision ?? 0, fields: { consent: "yes", rulesDigest: COMMUNITY_RULES_DIGEST, ...fields } };
    state = transitionCommunity(state, request, actor, at, `civic:${++serial}`); return state;
  };
  run("alice", "adopt", { name: "Grove", capacity: "1", capacityPlan: "One community participation place; expand by consent." });
  return { run, get: () => state! };
}
test("allocation is capacity bounded, FIFO, and unaffected by founder status", () => {
  const c=setup();c.run("bob","join");c.run("bob","request-place");c.run("alice","request-place");
  assert.equal(c.get().allocations.bob.status,"allocated");assert.equal(c.get().allocations.alice.status,"waiting");
  c.run("bob","release-place");assert.equal(c.get().allocations.alice.status,"allocated");
  const before=structuredClone(c.get());assert.throws(()=>c.run("outsider","request-place"));assert.deepEqual(c.get(),before);
});
test("adoption binds exact rules and rejects invalid, stale and forged inputs", () => {
  const c=setup(), before=structuredClone(c.get());
  assert.throws(()=>transitionCommunity(c.get(),{expectedActor:"bob",action:"join",communityId:c.get().id,expectedRevision:0,fields:{consent:"yes"}},"bob",0,"x"));
  assert.throws(()=>c.run("bob","join",{rulesDigest:"forged"}));
  assert.throws(()=>transitionCommunity(c.get(),{expectedActor:"alice",action:"check-in",communityId:c.get().id,expectedRevision:c.get().revision,fields:{}},"bob",0,"wrong-account"));
  assert.throws(()=>c.run("alice","propose",{capacity:"Infinity",capacityPlan:"x"}));
  assert.throws(()=>c.run("alice","unknown"));assert.deepEqual(c.get(),before);
});
test("inactivity needs both windows, a check-in restores standing, and delegation expires", () => {
  const c=setup();c.run("bob","join");c.run("alice","request-place");
  assert.throws(()=>c.run("bob","notice",{member:"alice"},29*day));
  c.run("bob","notice",{member:"alice"},30*day);assert.throws(()=>c.run("bob","release-inactive",{member:"alice"},36*day));
  c.run("alice","check-in",{},36*day);assert.equal(c.get().allocations.alice.noticeAt,null);
  c.run("bob","notice",{member:"alice"},66*day);c.run("bob","release-inactive",{member:"alice"},73*day);assert.equal(c.get().allocations.alice,undefined);
  c.run("alice","delegate",{member:"bob",reason:"Help while away"},73*day);c.run("bob","request-place",{member:"alice"},74*day);c.run("alice","release-place",{},74*day);
  assert.throws(()=>c.run("bob","request-place",{member:"alice"},104*day));c.run("alice","revoke-delegate",{},104*day);assert.equal(c.get().guardians.alice,undefined);
});
test("findings require consent and an independent reviewer; appeal preserves history and freezes remedies", () => {
  const c=setup();for(const p of ["bob","judge","reviewer"])c.run(p,"join");c.run("alice","request-place");c.run("bob","notice",{member:"alice"},30*day);
  c.run("alice","open-case",{member:"bob",judge:"judge",reason:"Notice challenged",evidence:"Public source event and limitations"},30*day);
  const record=Object.keys(c.get().disputes)[0];const finding={record,result:"supported",remedy:"cancel-notice",reason:"Source notice reviewed under the charter",dissent:"none"};
  assert.throws(()=>c.run("judge","find",finding,30*day));assert.throws(()=>c.run("judge","case-consent",{record,conflicts:"material"},30*day));
  c.run("bob","case-consent",{record},30*day);c.run("judge","case-consent",{record,conflicts:"none"},30*day);c.run("judge","find",finding,30*day);
  c.run("bob","appeal",{record,reason:"Review the source again"},31*day);assert.throws(()=>c.run("alice","remedy",{record},38*day));
  assert.throws(()=>c.run("bob","appeal-reviewer",{record,judge:"judge"},38*day));c.run("bob","appeal-reviewer",{record,judge:"reviewer"},38*day);
  c.run("alice","case-consent",{record},38*day);c.run("reviewer","case-consent",{record,conflicts:"none"},38*day);c.run("reviewer","find",finding,38*day);
  assert.throws(()=>c.run("bob","release-inactive",{member:"alice"},46*day));c.run("alice","remedy",{record},46*day);
  assert.equal(c.get().disputes[record].findings.length,2);assert.equal(c.get().allocations.alice.noticeAt,null);assert.throws(()=>c.run("alice","remedy",{record},46*day));
});
test("work obligations require debtor consent and record consensual discharge without invented payment", () => {
  const c=setup();c.run("bob","join");c.run("alice","offer-obligation",{member:"bob",units:"10",terms:"Ten community work units; completion acknowledged by creditor; relief by agreement."});
  const record=Object.keys(c.get().obligations)[0];assert.throws(()=>c.run("alice","accept-obligation",{record}));c.run("bob","accept-obligation",{record});
  c.run("alice","acknowledge-work",{record,units:"2"});c.run("bob","propose-insolvency",{record,units:"0"});assert.throws(()=>c.run("bob","accept-insolvency",{record}));
  c.run("alice","accept-insolvency",{record});assert.equal(c.get().obligations[record].discharged,8);assert.equal(c.get().obligations[record].completed,true);
});
test("ratification needs the exact current electorate and cannot remove an allocated place", () => {
  const c=setup();c.run("bob","join");c.run("alice","propose",{capacity:"2",capacityPlan:"Two participation places"});assert.equal(c.get().capacity,1);
  assert.throws(()=>c.run("outsider","join"));assert.throws(()=>c.run("bob","withdraw-proposal"));c.run("bob","ratify");assert.equal(c.get().capacity,2);assert.equal(c.get().adoptions.length,2);
});
test("world execution, replay, retry and checkpoint recovery preserve exact community transitions", () => {
  const service=new WildsWorldService();const authority={actorId:"alice",canonical:true,pulse:"2026-09-12T00:00:00.000Z",occurredAt:"2026-09-12T00:00:00.000Z"};
  const command={type:"community.transition" as const,commandId:"community:test-create",request:{expectedActor:"alice",action:"adopt",communityId:"test-community",expectedRevision:0,fields:{name:"Test",capacity:"1",capacityPlan:"One participation place",consent:"yes",rulesDigest:COMMUNITY_RULES_DIGEST}}};
  const accepted=service.execute(command,authority);assert.equal(accepted.constitution.result,"VALID");assert.equal(accepted.events.length,1);
  assert.equal(service.execute(command,authority).events.length,0);const snapshot=structuredClone(service.snapshot());
  assert.throws(()=>service.execute({...command,request:{...command.request,fields:{...command.request.fields,name:"Forged retry"}}},authority));assert.deepEqual(service.snapshot(),snapshot);
  const recovered=new WildsWorldService({checkpoint:service.checkpoint()});assert.deepEqual(recovered.snapshot().communities,snapshot.communities);assert.equal(recovered.execute(command,authority).events.length,0);
  const replay=new WildsWorldService({events:accepted.events});assert.deepEqual(replay.snapshot().communities,snapshot.communities);
});

import { createWorldConstitutionalDecisionScope, worldConstitutionalDecision } from "../src/features/play/wilds-world-constitution";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";
test("constitutional checks reuse source hashes only within one execution and retain identical decisions", () => {
  let reads = 0; const original = initialWildsWorldProjection();
  const before = { ...original, get revision() { reads++; return original.revision; } };
  const command = { type: "team.create" as const, name: "Team", commandId: "scope:team" };
  const authority = { actorId: "alice", canonical: true, pulse: "2026-09-12T00:00:00.000Z", occurredAt: "2026-09-12T00:00:00.000Z" };
  const scope = createWorldConstitutionalDecisionScope({ before, command, authority });
  const initialReads = reads; assert.ok(initialReads > 0);
  scope.decide(); const failed = scope.decide({ failure: "test-rejection" });
  assert.equal(reads, initialReads);
  assert.deepEqual(failed, worldConstitutionalDecision({ before: original, command, authority, failure: "test-rejection" }));
  assert.deepEqual(scope.decide({ after: original }), worldConstitutionalDecision({ before: original, command, authority, after: original }));
});

test("a conflicted reviewer can be replaced only with fresh consent and an allegation can be withdrawn", () => {
  const c=setup();for(const p of ["bob","judge","replacement"])c.run(p,"join");
  c.run("alice","open-case",{member:"bob",judge:"judge",reason:"Review request",evidence:"Reported source event"});
  const record=Object.keys(c.get().disputes)[0];c.run("bob","case-consent",{record});
  c.run("alice","case-reviewer",{record,judge:"replacement"});assert.deepEqual(c.get().disputes[record].consents,["alice"]);
  assert.throws(()=>c.run("bob","withdraw-case",{record}));c.run("alice","withdraw-case",{record});
  assert.equal(c.get().disputes[record].withdrawn,true);assert.throws(()=>c.run("bob","case-consent",{record}));
});
