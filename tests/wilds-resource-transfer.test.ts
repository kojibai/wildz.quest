import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileWildsLivingOperation } from "../src/features/play/wilds-living-operation.js";
import { createWildsGroveResourceLot } from "../src/features/play/wilds-resource-lot.js";
import {
  claimWildsResourceTransfer,
  issueWildsResourceTransfer,
  projectWildsResourceSubjectAdmissionV122
} from "../src/lib/receiz/wilds-resource-transfer.js";

const digest = (character: string) => character.repeat(64);
const sender = { accessToken: "sender", ownerReceizId: "receiz:sender", actorId: "sender", profileHandle: "sender.receiz.id" };
const receiver = { accessToken: "receiver", ownerReceizId: "receiz:receiver", actorId: "receiver", profileHandle: "receiver.receiz.id" };
const nextReceiver = { accessToken: "next", ownerReceizId: "receiz:next", actorId: "next", profileHandle: "next.receiz.id" };

async function fixture() {
  const operation = compileWildsLivingOperation({
    operationId: "grove:one:harvest-honey:100", category: "ecology", intention: { kind: "grove.harvest-honey", regionId: "region:0:0", featureId: "grove:one" },
    participants: [{ id: sender.profileHandle, kind: "player", expectedHead: digest("a"), role: "steward" }], stages: [{ id: "stage:harvest", profession: "harvest-honey", participantIds: [sender.profileHandle] }],
    consequences: { usefulOutput: 2, ecologicalRenewal: 0, publicBenefit: 0, cooperation: 0, durability: 0, extraction: 0, damage: 0, waste: 0, restorationDebt: 0 },
    kaiUPulse: 100, expiresAtKaiUPulse: 1_000, semanticIdempotencyKey: "wildz:grove:one:harvest-honey:100"
  });
  const resourceLot = createWildsGroveResourceLot({ operation, ownerReceizId: sender.profileHandle, sourceGrove: { groveId: "grove:one", head: `sha256:${digest("b")}`, honey: 2 }, admittedGrove: { groveId: "grove:one", head: `sha256:${digest("c")}`, parentHead: `sha256:${digest("b")}`, honey: 1 } })!;
  const projected = await projectWildsResourceSubjectAdmissionV122(resourceLot, sender.ownerReceizId);
  let ownerReceizId = sender.ownerReceizId;
  let instrument: any;
  let receipt: any;
  let claimCount = 0;
  const state = () => ({ schema: "receiz.subject.state.v122", subjectId: projected.subjectId, admittedProofDigest: projected.admittedProofDigest, ownerReceizId, head: digest("d"), ownershipHead: digest("e") });
  const rail = {
    subjectStateV122: async () => state(), admitSubjectV122: async () => { throw new Error("existing"); },
    previewBearerTransfer: async ({ subjectId, policy }: any) => ({ schema: "receiz.bearer.transfer_plan.v1", transferId: digest("1"), transferDigest: digest("1"), subjectId, subjectDigest: projected.admittedProofDigest, expectedSubjectHead: state().head, expectedOwnershipHead: state().ownershipHead, currentOwnerReceizId: ownerReceizId, policy, policyDigest: digest("2"), registryDigest: digest("3"), reducerDigest: digest("4") }),
    issueBearerTransferInstrument: async ({ plan }: any) => (instrument = { schema: "receiz.bearer.instrument.v1", plan, oneTimeClaimDigest: digest("5"), issuedAtKai: "100", exactBytesB64u: "ZXhhY3Q", artifactDigest: digest("6"), status: "pending-acceptance" }),
    inspectBearerTransferInstrument: async () => ({ valid: true, offlineVerified: true, instrument }),
    claimBearerTransferInstrument: async (_instrument: any, capability: any) => {
      if (receipt) return { ok: true, receipt, idempotent: true };
      claimCount += 1; ownerReceizId = capability.receizId;
      receipt = { schema: "receiz.bearer.transfer_receipt.v1", receiptId: `receipt:${digest("7").slice(0, 32)}`, transferId: instrument.plan.transferId, instrumentDigest: instrument.artifactDigest, subjectId: projected.subjectId, identityDigest: digest("8"), priorOwnerReceizId: sender.ownerReceizId, nextOwnerReceizId: receiver.ownerReceizId, priorSubjectHead: digest("d"), nextSubjectHead: digest("9"), priorOwnershipHead: digest("e"), nextOwnershipHead: digest("0"), eventIds: [], revokedMandateDigests: [], revokedCapabilityDigests: [], cancelledRuntimeJobIds: [], inventoryDispositionDigest: digest("a"), memoryPolicyDigest: digest("b"), sealedArtifact: {}, kai: "101", registryDigest: digest("3"), reducerDigest: digest("4") };
      return { ok: true, receipt, idempotent: false };
    }
  };
  return { resourceLot, rail, metrics: () => ({ ownerReceizId, claimCount }) };
}

describe("proof-native resource bearer transfer", () => {
  it("keeps source custody pending and moves the exact lot once on recipient claim", async () => {
    const data = await fixture();
    const offer = await issueWildsResourceTransfer({ authority: sender, resourceLot: data.resourceLot, targetHandle: receiver.profileHandle, rail: data.rail as never, currentKai: 100 });
    assert.equal(data.metrics().ownerReceizId, sender.ownerReceizId);
    const admitted = await claimWildsResourceTransfer({ authority: receiver, offer, rail: data.rail as never });
    assert.equal(admitted.resourceLot.lotId, data.resourceLot.lotId);
    assert.equal(admitted.receipt.nextOwnerReceizId, receiver.ownerReceizId);
    assert.equal(data.metrics().ownerReceizId, receiver.ownerReceizId);
    const replay = await claimWildsResourceTransfer({ authority: receiver, offer, rail: data.rail as never });
    assert.equal(replay.idempotent, true);
    assert.equal(data.metrics().claimCount, 1);
  });

  it("rejects a different recipient without moving custody", async () => {
    const data = await fixture();
    const offer = await issueWildsResourceTransfer({ authority: sender, resourceLot: data.resourceLot, targetHandle: receiver.profileHandle, rail: data.rail as never, currentKai: 100 });
    await assert.rejects(claimWildsResourceTransfer({ authority: { ...receiver, profileHandle: "intruder.receiz.id" }, offer, rail: data.rail as never }), /recipient_invalid/);
    assert.equal(data.metrics().ownerReceizId, sender.ownerReceizId);
  });

  it("lets the current subject owner send onward without rewriting creator provenance", async () => {
    const data = await fixture();
    const firstOffer = await issueWildsResourceTransfer({ authority: sender, resourceLot: data.resourceLot, targetHandle: receiver.profileHandle, rail: data.rail as never, currentKai: 100 });
    await claimWildsResourceTransfer({ authority: receiver, offer: firstOffer, rail: data.rail as never });
    const onward = await issueWildsResourceTransfer({ authority: receiver, resourceLot: data.resourceLot, targetHandle: nextReceiver.profileHandle, rail: data.rail as never, currentKai: 102 });
    assert.equal(onward.instrument.plan.currentOwnerReceizId, receiver.ownerReceizId);
    assert.equal(onward.targetHandle, nextReceiver.profileHandle);
    assert.equal(onward.resourceLot.ownerReceizId, sender.profileHandle);
  });
});
