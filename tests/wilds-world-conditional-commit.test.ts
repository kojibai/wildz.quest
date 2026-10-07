import assert from "node:assert/strict";
import { test } from "node:test";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import { initialWildsWorldProjection, checkpointWildsWorld } from "../src/features/play/wilds-world-state";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { createWildsResourcePackage } from "../src/features/play/wilds-resource-package";
import { createKaiTemporalRoot } from "../src/features/play/kai-temporal-root";
import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";
import { createReceizWildsWorldRepository, type WildsWorldRepository } from "../src/lib/receiz/wilds-world-repository";
import { commitWildsConditionalWorldCandidate } from "../src/lib/receiz/wilds-world-conditional-commit";
import type { WildsWorldRecord } from "../src/features/play/wilds-world-record";

const owner = "source_owner.receiz.id", sourceUrl = "https://wildz.quest/api/wilds/world/snapshot";
const actor = { handle: owner, receizActorId: "usr_source_owner", accessToken: "cookie-source", practice: false };
const authority = { actorId: owner, canonical: true, pulse: "2026-10-07T12:00:00.000Z", occurredAt: "2026-10-07T12:00:00.000Z", uPulse: 100 };
const kai = (uPulse = 100) => createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse, authority: "world" }));
const record = (world: WildsWorldService) => ({ checkpoint: world.checkpoint(), eventTail: world.events() });
function fixtures() {
  const source = projectWildsResourceRegion(0, 0).find(item => item.kind === "hay")!;
  const lot = createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: owner, actorPosition: source.position, kaiUPulse: 100 }).lot;
  const before = new WildsWorldService({ checkpoint: checkpointWildsWorld({ ...initialWildsWorldProjection(), materialLots: { [lot.lotId]: lot } }) });
  const packageFor = (commandId: string) => createWildsResourcePackage({ ownerReceizId: owner, createdKaiUPulse: 100, commandId, members: [{ kind: "material", id: lot.lotId, materialLot: lot }] });
  return { before, lot, packageFor };
}

test("a package CAS loser installs only the verified winner and can commit its next lawful action", async () => {
  const { before, lot, packageFor } = fixtures();
  const leftPackage = packageFor("package:left"), rightPackage = packageFor("package:right");
  const left = new WildsWorldService({ checkpoint: before.checkpoint(), events: before.events() }), right = new WildsWorldService({ checkpoint: before.checkpoint(), events: before.events() });
  left.execute({ type: "resource.package.create", package: leftPackage, commandId: leftPackage.commandId, kai: kai() }, authority);
  right.execute({ type: "resource.package.create", package: rightPackage, commandId: rightPackage.commandId, kai: kai() }, authority);
  assert.equal(before.checkpoint().revision, 0);
  assert.equal(before.snapshot().reservedMaterialLots[lot.lotId], undefined);
  let remote: WildsWorldRecord = record(right), local = before;
  const expectedHeads: Array<{ revision: number; lastEventId: string | null }> = [];
  const proof = (value: WildsWorldRecord) => `native:${value.checkpoint.revision}:${value.checkpoint.lastEventId}`;
  const repository = createReceizWildsWorldRepository({ adapterFactory: () => ({ wildzWorld: {
    readLatest: async () => ({ record: remote, admissionProof: proof(remote) }),
    compareAndAppend: async (input: { record: WildsWorldRecord; expectedHead: { revision: number; lastEventId: string | null } }) => {
      expectedHeads.push(input.expectedHead);
      if (input.expectedHead.revision !== remote.checkpoint.revision || input.expectedHead.lastEventId !== remote.checkpoint.lastEventId) return { status: "conflict", record: remote, admissionProof: proof(remote) };
      remote = input.record; return { status: "admitted", record: remote, admissionProof: proof(remote) };
    },
    verifyAdmissionProof: async (input: { record: WildsWorldRecord; proof: unknown }) => input.proof === proof(input.record)
  } }) as never });
  const losing = await commitWildsConditionalWorldCandidate({ repository, sourceUrl, actor, before, candidate: left, install: world => { local = world; } });
  assert.equal(losing.publication.published, false);
  assert.equal(local.checkpoint().lastEventId, right.checkpoint().lastEventId);
  assert.equal(local.snapshot().resourcePackages?.[leftPackage.packageId], undefined);
  assert.equal(local.snapshot().resourcePackages?.[rightPackage.packageId]?.status, "packed");
  assert.throws(() => new WildsWorldService({ checkpoint: local.checkpoint(), events: local.events() }).execute({ type: "resource.package.create", package: leftPackage, commandId: leftPackage.commandId, kai: kai(101) }, { ...authority, uPulse: 101 }), /unavailable/);
  const candidate = new WildsWorldService({ checkpoint: local.checkpoint(), events: local.events() });
  candidate.execute({ type: "resource.package.unpack", packageId: rightPackage.packageId, commandId: "unpack:winner", kai: kai(101) }, { ...authority, uPulse: 101 });
  const admitted = await commitWildsConditionalWorldCandidate({ repository, sourceUrl, actor, before: local, candidate, install: world => { local = world; } });
  assert.equal(admitted.publication.published, true);
  assert.equal(local.snapshot().resourcePackages?.[rightPackage.packageId]?.status, "unpacked");
  assert.equal(local.snapshot().reservedMaterialLots[lot.lotId], undefined);
  assert.deepEqual(expectedHeads, [{ revision: 0, lastEventId: null }, { revision: right.checkpoint().revision, lastEventId: right.checkpoint().lastEventId }]);
});

test("unknown or weak publication never installs a pending package candidate", async () => {
  const { before, packageFor } = fixtures(), packageProof = packageFor("package:pending");
  const candidate = new WildsWorldService({ checkpoint: before.checkpoint(), events: before.events() });
  candidate.execute({ type: "resource.package.create", package: packageProof, commandId: packageProof.commandId, kai: kai() }, authority);
  let installed = 0;
  const repository: WildsWorldRepository = { recover: async () => null, audit: async () => true, publish: async () => ({ published: false, mode: "receiz_recovery_pending", revision: candidate.checkpoint().revision }) };
  const pending = await commitWildsConditionalWorldCandidate({ repository, sourceUrl, actor, before, candidate, install: () => { installed++; } });
  assert.equal(pending.world, before); assert.equal(installed, 0);
  repository.publish = async () => ({ published: true, mode: "receiz_live", revision: candidate.checkpoint().revision, record: record(candidate) });
  const weak = await commitWildsConditionalWorldCandidate({ repository, sourceUrl, actor, before, candidate, install: () => { installed++; } });
  assert.equal(weak.publication.published, false); assert.equal(installed, 0);
});

test("required conditional publication and recovery never consult a public feed", async () => {
  const { before } = fixtures(); let publicCalls = 0;
  const weak = createReceizWildsWorldRepository({ adapterFactory: () => ({ readAppStateByUrl: async () => { publicCalls++; return record(before); }, publishPublicStore: async () => { publicCalls++; return { ok: true, accepted: 1 }; } }) as never });
  await assert.rejects(weak.recoverConditional!(sourceUrl, actor), /conditional_resource_custody_unavailable/);
  assert.equal((await weak.publish({ sourceUrl, actor, record: record(before), expectedHead: { revision: 0, lastEventId: null }, requireConditional: true })).published, false);
  const invalid = createReceizWildsWorldRepository({ adapterFactory: () => ({ readAppStateByUrl: async () => { publicCalls++; return record(before); }, wildzWorld: {
    readLatest: async () => ({ record: record(before), admissionProof: "forged" }), compareAndAppend: async () => ({ status: "admitted", record: record(before), admissionProof: "forged" }), verifyAdmissionProof: async () => false
  } }) as never });
  const refused = await invalid.publish({ sourceUrl, actor, record: record(before), expectedHead: { revision: 0, lastEventId: null }, requireConditional: true });
  assert.equal(refused.published, false); assert.equal(refused.record, undefined); assert.equal(publicCalls, 0);
});
