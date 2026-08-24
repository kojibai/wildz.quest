import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RECEIZ_V123_REGISTRY_DIGEST, digestReceizCanonicalV122 } from "@receiz/sdk";
import { applyWildsInput, createOwnerBoundInitialPlayState } from "../src/features/play/game-state.js";
import { issueWildsCardTransfer, claimWildsCardTransfer } from "../src/lib/receiz/wilds-card-transfer.js";
import { projectWildsCreatureSubjectAdmissionV122 } from "../src/lib/receiz/wilds-v122-subjects.js";

const sender = { accessToken: "sender-token", ownerReceizId: "receiz:sender", actorId: "sender", profileHandle: "sender.receiz.id" };
const receiver = { accessToken: "receiver-token", ownerReceizId: "receiz:receiver", actorId: "receiver", profileHandle: "receiver.receiz.id" };

async function fixture() {
  const senderVault = createOwnerBoundInitialPlayState(sender.profileHandle, "2026-08-23T20:00:00.000Z");
  const card = senderVault.inventory[0]!;
  const projected = await projectWildsCreatureSubjectAdmissionV122(card, sender.ownerReceizId);
  const receiptBasis = {
    schema: "receiz.subject.admission-receipt.v122" as const,
    subjectId: projected.subjectId, proofObjectId: "proof:wildz-card", admittedProofDigest: projected.admittedProofDigest,
    immutableProofVersion: "wildz.card.v1", ownerReceizId: sender.ownerReceizId, ownerProofDigest: "1".repeat(64),
    genesisHead: "2".repeat(64), registryDigest: RECEIZ_V123_REGISTRY_DIGEST, reducerDigest: "3".repeat(64), kai: 1,
    idempotencyIdentityDigest: "4".repeat(64), authority: { receiptIsProofAuthority: false as const, strongerTruth: "sealed-receiz-proof-object" as const }
  };
  const admissionReceipt = { ...receiptBasis, receiptDigest: await digestReceizCanonicalV122(receiptBasis) };
  let ownerReceizId = sender.ownerReceizId;
  let claims = 0;
  let issued = false;
  const state = () => ({
    schema: "receiz.subject.state.v122" as const, subjectId: projected.subjectId, proofObjectId: admissionReceipt.proofObjectId,
    admittedProofDigest: projected.admittedProofDigest, immutableProofVersion: admissionReceipt.immutableProofVersion,
    subjectType: "wildz.creature", opaqueNamespaces: [], genesisHead: admissionReceipt.genesisHead, head: admissionReceipt.genesisHead,
    ownerReceizId, ownershipHead: "5".repeat(64), ownerProofDigest: admissionReceipt.ownerProofDigest,
    registryDigest: RECEIZ_V123_REGISTRY_DIGEST, reducerDigest: admissionReceipt.reducerDigest, admissionReceipt,
    causalParents: [], accessKeyHead: null, replay: { appendCursor: "genesis", eventCursor: "genesis" },
    authority: { stateIsProofAuthority: false as const, strongerTruth: "sealed-receiz-proof-object" as const }, stateDigest: "6".repeat(64)
  });
  let instrument: any;
  let committedReceipt: any;
  const rail = {
    subjectStateV122: async () => state(),
    admitSubjectV122: async () => { throw new Error("existing source must not be re-admitted"); },
    previewBearerTransfer: async ({ subjectId, policy }: any) => ({
      schema: "receiz.bearer.transfer_plan.v1", transferId: "a".repeat(64), transferDigest: "a".repeat(64), subjectId,
      subjectDigest: projected.admittedProofDigest, expectedSubjectHead: state().head, expectedOwnershipHead: state().ownershipHead,
      currentOwnerReceizId: ownerReceizId, policy, policyDigest: "b".repeat(64), registryDigest: RECEIZ_V123_REGISTRY_DIGEST, reducerDigest: "3".repeat(64)
    }),
    issueBearerTransferInstrument: async ({ plan }: any) => {
      issued = true;
      instrument = { schema: "receiz.bearer.instrument.v1", plan, oneTimeClaimDigest: "c".repeat(64), issuedAtKai: "100", exactBytesB64u: "ZXhhY3Q", artifactDigest: "d".repeat(64), status: "pending-acceptance" };
      return instrument;
    },
    inspectBearerTransferInstrument: async () => ({ valid: true, offlineVerified: true, instrument, sourcePrimitive: "receiz.bearer.instrument.v1", registryDigest: RECEIZ_V123_REGISTRY_DIGEST, reducerDigest: "3".repeat(64) }),
    claimBearerTransferInstrument: async (_instrument: any, capability: any) => {
      if (committedReceipt) return { ok: true, receipt: committedReceipt, idempotent: true };
      claims += 1;
      ownerReceizId = capability.receizId;
      committedReceipt = {
        schema: "receiz.bearer.transfer_receipt.v1", receiptId: "receipt:" + "e".repeat(32), transferId: instrument.plan.transferId,
        instrumentDigest: instrument.artifactDigest, subjectId: projected.subjectId, identityDigest: "f".repeat(64),
        priorOwnerReceizId: sender.ownerReceizId, nextOwnerReceizId: receiver.ownerReceizId,
        priorSubjectHead: "2".repeat(64), nextSubjectHead: "7".repeat(64), priorOwnershipHead: "5".repeat(64), nextOwnershipHead: "8".repeat(64),
        eventIds: [], revokedMandateDigests: [], revokedCapabilityDigests: [], cancelledRuntimeJobIds: [],
        inventoryDispositionDigest: "9".repeat(64), memoryPolicyDigest: "0".repeat(64), sealedArtifact: {}, kai: "101",
        registryDigest: RECEIZ_V123_REGISTRY_DIGEST, reducerDigest: "3".repeat(64)
      };
      return { ok: true, receipt: committedReceipt, idempotent: false };
    }
  };
  return { senderVault, card, rail, metrics: () => ({ ownerReceizId, claims, issued }) };
}

describe("online proof-native card transfer", () => {
  it("keeps sender custody while pending, then moves both Vaults only after admitted claim", async () => {
    const f = await fixture();
    const offer = await issueWildsCardTransfer({ authority: sender, card: f.card, targetHandle: receiver.profileHandle, rail: f.rail as never, currentKai: 100 });
    assert.equal(f.metrics().issued, true);
    assert.equal(f.metrics().ownerReceizId, sender.ownerReceizId);
    assert.equal(f.senderVault.inventory.some((card) => card.id === f.card.id), true);
    const admission = await claimWildsCardTransfer({ authority: receiver, offer, rail: f.rail as never });
    assert.equal(admission.receipt.nextOwnerReceizId, receiver.ownerReceizId);
    assert.equal(f.metrics().ownerReceizId, receiver.ownerReceizId);
    const senderAfter = applyWildsInput(f.senderVault, { type: "transfer-card-out", assetId: f.card.id });
    const receiverAfter = applyWildsInput(createOwnerBoundInitialPlayState(receiver.profileHandle), { type: "import-card", asset: admission.card });
    assert.equal(senderAfter.inventory.some((card) => card.id === f.card.id), false);
    assert.equal(receiverAfter.inventory.some((card) => card.id === f.card.id), true);
    const replay = await claimWildsCardTransfer({ authority: receiver, offer, rail: f.rail as never });
    assert.equal(replay.idempotent, true);
    assert.equal(f.metrics().claims, 1);
  });

  it("rejects a claim from any Receiz ID other than the private target", async () => {
    const f = await fixture();
    const offer = await issueWildsCardTransfer({ authority: sender, card: f.card, targetHandle: receiver.profileHandle, rail: f.rail as never, currentKai: 100 });
    await assert.rejects(claimWildsCardTransfer({ authority: { ...receiver, profileHandle: "intruder.receiz.id" }, offer, rail: f.rail as never }), /recipient_invalid/);
    assert.equal(f.metrics().ownerReceizId, sender.ownerReceizId);
    assert.equal(f.metrics().claims, 0);
  });
});
