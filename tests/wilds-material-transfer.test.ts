import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { claimWildsMaterialTransfer, issueWildsMaterialTransfer, projectWildsMaterialSubjectAdmissionV122 } from "../src/lib/receiz/wilds-resource-transfer";
import { createWildsMaterialPortableClaim, decodeWildsPortableClaim, encodeWildsPortableClaim } from "../src/features/play/wilds-portable-claim";

const digest = (character: string) => character.repeat(64);
const sender = { accessToken: "sender", ownerReceizId: "receiz:sender", actorId: "sender", profileHandle: "sender.receiz.id" };
const receiver = { accessToken: "receiver", ownerReceizId: "receiz:receiver", actorId: "receiver", profileHandle: "receiver.receiz.id" };

async function fixture() {
  const source = [-2, -1, 0, 1, 2].flatMap((x) => [-2, -1, 0, 1, 2].flatMap((z) => projectWildsResourceRegion(x, z))).find((candidate) => candidate.kind === "timber")!;
  const materialLot = createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: sender.profileHandle, actorPosition: source.position, kaiUPulse: 100 }).lot;
  const projected = await projectWildsMaterialSubjectAdmissionV122(materialLot, sender.ownerReceizId);
  let ownerReceizId = sender.ownerReceizId;
  let instrument: any;
  let receipt: any;
  let claimCount = 0;
  const state = () => ({ schema: "receiz.subject.state.v122", subjectId: projected.subjectId, admittedProofDigest: projected.admittedProofDigest, ownerReceizId, head: digest("d"), ownershipHead: digest("e") });
  const rail = {
    subjectStateV122: async () => state(),
    admitSubjectV122: async () => { throw new Error("existing"); },
    previewBearerTransfer: async ({ subjectId, policy }: any) => ({ schema: "receiz.bearer.transfer_plan.v1", transferId: digest("1"), transferDigest: digest("1"), subjectId, subjectDigest: projected.admittedProofDigest, expectedSubjectHead: state().head, expectedOwnershipHead: state().ownershipHead, currentOwnerReceizId: ownerReceizId, policy, policyDigest: digest("2"), registryDigest: digest("3"), reducerDigest: digest("4") }),
    issueBearerTransferInstrument: async ({ plan }: any) => (instrument = { schema: "receiz.bearer.instrument.v1", plan, oneTimeClaimDigest: digest("5"), issuedAtKai: "100", exactBytesB64u: "ZXhhY3Q", artifactDigest: digest("6"), status: "pending-acceptance" }),
    inspectBearerTransferInstrument: async () => ({ valid: true, offlineVerified: true, instrument }),
    claimBearerTransferInstrument: async (_instrument: any, capability: any) => {
      if (receipt) return { ok: true, receipt, idempotent: true };
      claimCount += 1;
      ownerReceizId = capability.receizId;
      receipt = { schema: "receiz.bearer.transfer_receipt.v1", receiptId: `receipt:${digest("7").slice(0, 32)}`, transferId: instrument.plan.transferId, instrumentDigest: instrument.artifactDigest, subjectId: projected.subjectId, identityDigest: digest("8"), priorOwnerReceizId: sender.ownerReceizId, nextOwnerReceizId: receiver.ownerReceizId, priorSubjectHead: digest("d"), nextSubjectHead: digest("9"), priorOwnershipHead: digest("e"), nextOwnershipHead: digest("0"), eventIds: [], revokedMandateDigests: [], revokedCapabilityDigests: [], cancelledRuntimeJobIds: [], inventoryDispositionDigest: digest("a"), memoryPolicyDigest: digest("b"), sealedArtifact: {}, kai: "101", registryDigest: digest("3"), reducerDigest: digest("4") };
      return { ok: true, receipt, idempotent: false };
    }
  };
  return { materialLot, rail, metrics: () => ({ ownerReceizId, claimCount }) };
}

describe("proof-native material bearer transfer", () => {
  it("keeps the exact lot with its source owner until one recipient claim changes custody", async () => {
    const data = await fixture();
    const offer = await issueWildsMaterialTransfer({ authority: sender, materialLot: data.materialLot, targetHandle: receiver.profileHandle, rail: data.rail as never, currentKai: 100 });
    const portable = createWildsMaterialPortableClaim(offer);
    assert.equal(portable.carrier.kind, "bearer-material");
    assert.deepEqual(decodeWildsPortableClaim(encodeWildsPortableClaim(portable)), portable);
    assert.equal(data.metrics().ownerReceizId, sender.ownerReceizId);
    const admitted = await claimWildsMaterialTransfer({ authority: receiver, offer, rail: data.rail as never });
    assert.equal(admitted.materialLot, data.materialLot);
    assert.equal(admitted.receipt.nextOwnerReceizId, receiver.ownerReceizId);
    const replay = await claimWildsMaterialTransfer({ authority: receiver, offer, rail: data.rail as never });
    assert.equal(replay.idempotent, true);
    assert.equal(data.metrics().claimCount, 1);
  });
});
