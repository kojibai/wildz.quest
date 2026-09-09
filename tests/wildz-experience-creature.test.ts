import assert from "node:assert/strict";
import {creatureForms} from "../src/features/play/creature-catalog";
import {test} from "node:test";
import {admitWildzExperienceCreature} from "../src/experience/creature";
import {openCreatureTrailExperience} from "../examples/creature-experience";
import {sealCollectedCard,wildsCardVerificationDiagnostics} from "../src/features/play/portable-card";
const card=sealCollectedCard({capturedAt:"2026-09-08T12:00:00.000Z",encounterId:"developer:trail",formId:creatureForms.find(f=>f.stage===1)!.id,ownerReceizId:"developer"});
test("experience example carries exact identity and uses actual current capabilities",()=>{
  const result=openCreatureTrailExperience(card);assert.ok(result.ok);
  assert.equal(result.creature.assetId,card.id);assert.equal(result.creature.proofDigest,card.proof.digest);
  assert.deepEqual(result.creature.card,card);
  assert.ok(Object.isFrozen(result.creature.card));
  assert.equal(result.routes.find(r=>r.id==="woodland")?.compatible,true);
  assert.equal(result.routes.find(r=>r.id==="river")?.compatible,result.creature.runtime.capabilities.includes("swim"));
  const before=wildsCardVerificationDiagnostics().executions;
  const again=admitWildzExperienceCreature(result.creature.card);assert.ok(again.ok);
  assert.equal(again.creature,result.creature);
  assert.equal(wildsCardVerificationDiagnostics().executions,before,"reusing the admitted object does not reverify");
});
test("experience admission rejects altered cards and malformed input",()=>{
  const changed=JSON.parse(JSON.stringify(card));changed.manifest.ownerReceizId="other";
  assert.equal(admitWildzExperienceCreature(changed).ok,false);
  for(const invalid of [null,{},"card",{proof:{digest:card.proof.digest}}])assert.equal(admitWildzExperienceCreature(invalid).ok,false);
});
