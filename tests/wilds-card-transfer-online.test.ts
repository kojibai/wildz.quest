import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RECEIZ_V123_REGISTRY_DIGEST, digestReceizCanonicalV122 } from "@receiz/sdk";
import { applyWildsInput, createOwnerBoundInitialPlayState } from "../src/features/play/game-state.js";
import { issueWildsCardTransfer, claimWildsCardTransfer } from "../src/lib/receiz/wilds-card-transfer.js";
import { projectWildsCreatureSubjectAdmissionV122 } from "../src/lib/receiz/wilds-v122-subjects.js";
import { createWildsCardPortableClaim, encodeWildsPortableClaim, decodeWildsPortableClaim } from "../src/features/play/wilds-portable-claim";

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
    wildzWorld: { resolveRecipientIdentity: async ({ profileHandle }: { profileHandle: string }) => ({ verified: true, profileHandle, receizActorId: receiver.ownerReceizId }) },
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
    assert.equal(offer.instrument.plan.policy.openBearer, false);
    assert.equal(offer.instrument.plan.policy.recipientReceizId, receiver.ownerReceizId);
    const claim = createWildsCardPortableClaim(offer);
    assert.deepEqual(decodeWildsPortableClaim(encodeWildsPortableClaim(claim)), claim);
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

  it("preserves the existing private one-use path when no account resolver capability is installed", async () => {
    const f = await fixture();
    const { wildzWorld: _unused, ...withoutResolver } = f.rail;
    const offer = await issueWildsCardTransfer({ authority: sender, card: f.card, targetHandle: "@Receiver", rail: withoutResolver as never });
    assert.equal(offer.targetHandle, receiver.profileHandle);
    assert.equal(offer.instrument.plan.policy.openBearer, true);
    assert.equal(offer.instrument.plan.policy.recipientReceizId, null);
    await assert.rejects(claimWildsCardTransfer({ authority: { ...receiver, profileHandle: "other.receiz.id" }, offer, rail: withoutResolver as never }), /recipient_invalid/);
    assert.equal(f.metrics().claims, 0);
    assert.equal((await claimWildsCardTransfer({ authority: receiver, offer, rail: withoutResolver as never })).receipt.nextOwnerReceizId, receiver.ownerReceizId);
  });

  it("rejects unverified or mismatched account bindings without deriving an ID from the username", async () => {
    for (const binding of [
      { verified: false, profileHandle: receiver.profileHandle, receizActorId: receiver.ownerReceizId },
      { verified: true, profileHandle: "other.receiz.id", receizActorId: receiver.ownerReceizId }
    ]) {
      const f = await fixture();
      f.rail.wildzWorld.resolveRecipientIdentity = async () => binding;
      await assert.rejects(issueWildsCardTransfer({ authority: sender, card: f.card, targetHandle: receiver.profileHandle, rail: f.rail as never }), (cause: unknown) => {
        assert.match((cause as Error).message, /recipient_binding_invalid/);
        assert.equal((cause as { writesOnFailure?: number }).writesOnFailure, 0);
        return true;
      });
      assert.equal(f.metrics().issued, false);
    }
  });

  it("checks native recipient identity even when a claim presents the expected profile handle", async () => {
    const f = await fixture();
    const offer = await issueWildsCardTransfer({ authority: sender, card: f.card, targetHandle: receiver.profileHandle, rail: f.rail as never });
    await assert.rejects(claimWildsCardTransfer({ authority: { ...receiver, ownerReceizId: "receiz:intruder" }, offer, rail: f.rail as never }), /recipient_invalid/);
    assert.equal(f.metrics().claims, 0);
    assert.equal(f.metrics().ownerReceizId, sender.ownerReceizId);
  });

  it("rejects a native preview that drops the verified recipient before issuing its bearer", async () => {
    const f = await fixture(), preview = f.rail.previewBearerTransfer;
    f.rail.previewBearerTransfer = async input => {
      const plan = await preview(input);
      return { ...plan, policy: { ...plan.policy, recipientReceizId: null, openBearer: true } };
    };
    await assert.rejects(issueWildsCardTransfer({ authority: sender, card: f.card, targetHandle: receiver.profileHandle, rail: f.rail as never }), /plan_binding_invalid/);
    assert.equal(f.metrics().issued, false);
  });

  it("reports a known source-owner preflight rejection without locking a nonexistent offer", async () => {
    const f = await fixture(), read = f.rail.subjectStateV122;
    f.rail.subjectStateV122 = async () => ({ ...await read(), ownerReceizId: "receiz:other-owner" });
    await assert.rejects(issueWildsCardTransfer({ authority: sender, card: f.card, targetHandle: receiver.profileHandle, rail: f.rail as never }), (cause: unknown) => {
      assert.match((cause as Error).message, /owner_invalid/);
      assert.equal((cause as { writesOnFailure?: number }).writesOnFailure, 0);
      return true;
    });
    assert.equal(f.metrics().issued, false);
  });

  it("preserves historical private open-bearer offers for their original target", async () => {
    const f = await fixture();
    const bound = await issueWildsCardTransfer({ authority: sender, card: f.card, targetHandle: receiver.profileHandle, rail: f.rail as never });
    const legacy = { ...bound, instrument: { ...bound.instrument, plan: { ...bound.instrument.plan, policy: { ...bound.instrument.plan.policy, openBearer: true, recipientReceizId: null } } } };
    f.rail.inspectBearerTransferInstrument = async () => ({ valid: true, offlineVerified: true, instrument: legacy.instrument, sourcePrimitive: "receiz.bearer.instrument.v1", registryDigest: RECEIZ_V123_REGISTRY_DIGEST, reducerDigest: "3".repeat(64) });
    assert.equal((await claimWildsCardTransfer({ authority: receiver, offer: legacy, rail: f.rail as never })).receipt.nextOwnerReceizId, receiver.ownerReceizId);
  });
});
