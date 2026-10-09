import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createReceizIdentityKeyFile, validateReceizOperationPlanV124, digestReceizCanonicalV122, receizBase64UrlEncode } from "@receiz/sdk";
import {
  prepareWildsWalletExecutionSourceMember,
  prepareWildsWalletExecutionSourceMemberFromAdmissions,
  combineWildsWalletExecutionSourceMembers,
  createWildsWalletExecutionSourceSealer
} from "../src/lib/receiz/wilds-wallet-execution-source-member.js";

async function fixture() {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "source-fixture.receiz.id" } });
  const payload = { schema: "source-recipe-diagnostic.v1" };
  const operationPlan = await validateReceizOperationPlanV124({
    schema: "receiz.operation_plan.v124", applicationId: "app.wildz.quest", domainId: "source-fixture",
    operationKind: payload.schema, registryDigest: "a".repeat(64), reducerDigest: "b".repeat(64),
    exactPlanBytesB64u: receizBase64UrlEncode(new TextEncoder().encode(JSON.stringify(payload))),
    exactPlanDigest: await digestReceizCanonicalV122(payload), expectedParticipantHeads: { source: "c".repeat(64) },
    semanticIdempotencyKey: "diagnostic:source", attemptId: "diagnostic:source", writesOnFailure: 0
  });
  const artifact = { schema: "receiz.sealed-artifact-bytes.v124" as const, exactBytesB64u: "aW52YWxpZA",
    filename: "invalid.receiz", mimeType: "application/vnd.receiz.bundle+json", artifactSha256: "d".repeat(64), payloadSha256: "e".repeat(64) };
  let seals = 0;
  const input = {
    predecessor: artifact, identityArtifact: artifact, keyFile, operationPlan, participantId: "source",
    planning: { commitDomain: { scheme: "receiz-commit-domain.v1" as const, value: "fixture" },
      namespace: { scheme: "receiz-namespace.v1" as const, value: "provenance" },
      event: { schema: "receiz.execution-authority-append.v124" as const, participantId: "source",
        applicationId: operationPlan.applicationId, exactPlanDigest: operationPlan.exactPlanDigest,
        requestDigest: "f".repeat(64), outcomeCoordinatesDigest: "0".repeat(64) }, idempotencyKey: "diagnostic:source" },
    currentKai: "10", expiresAtKai: "20", sealer: async () => { seals += 1; throw new Error("sealer must not run"); }
  };
  return { input, seals: () => seals };
}

describe("Wilds native execution source preparation", () => {
  it("forwards SDK successor bytes exactly to native Record + Seal with one plan idempotency key", async () => {
    const bytes = new TextEncoder().encode('{"future.namespace": { "unknown" : [3, 2, 1] },"settlement": {"exact":"unchanged"}}');
    const calls: unknown[] = [];
    const result = { nativeSealedFixture: true };
    const sealer = createWildsWalletExecutionSourceSealer({ assets: { createProofObject: async (payload: unknown, options: unknown) => {
      calls.push({ payload, options }); return result;
    } } } as never);
    assert.equal(await sealer({ plan: { planDigest: { value: "a".repeat(64) } } as never,
      predecessor: {} as never, successorPayloadBytes: bytes }), result);
    const call = calls[0] as { payload: { payload: { bytes: Uint8Array } }; options: { idempotencyKey: string } };
    assert.deepEqual(call.payload.payload.bytes, bytes);
    assert.notEqual(call.payload.payload.bytes, bytes);
    assert.equal(call.options.idempotencyKey, `wildz:wallet-source:${"a".repeat(64)}`);
  });
  it("rejects a participant outside the exact native plan before candidate sealing", async () => {
    const f = await fixture();
    await assert.rejects(prepareWildsWalletExecutionSourceMember({ ...f.input, participantId: "other" }), /PARTICIPANT/);
    assert.equal(f.seals(), 0);
  });

  it("rejects expired capability bounds before opening or sealing sources", async () => {
    const f = await fixture();
    await assert.rejects(prepareWildsWalletExecutionSourceMember({ ...f.input, expiresAtKai: "10" }), /KAI/);
    assert.equal(f.seals(), 0);
  });

  it("does not turn a transport digest or invalid bytes into a sealed predecessor", async () => {
    const f = await fixture();
    await assert.rejects(prepareWildsWalletExecutionSourceMember(f.input), /SOURCE|ARTIFACT/);
    assert.equal(f.seals(), 0);
  });

  it("does not accept caller-declared admission objects as native custody", async () => {
    const f = await fixture();
    await assert.rejects(prepareWildsWalletExecutionSourceMemberFromAdmissions({ ...f.input,
      predecessorAdmission: { verdict: "bearer-recovery", proofHistory: { headDigests: ["c".repeat(64)] } } as never,
      identityAdmission: { verdict: "canonical-identity" } as never }), /ADMISSION|SOURCE/);
    assert.equal(f.seals(), 0);
  });

  it("refuses incomplete source sets before native stage or commit", async () => {
    const f = await fixture();
    await assert.rejects(combineWildsWalletExecutionSourceMembers({ operationPlan: f.input.operationPlan, members: [], currentKai: "10" }), /PARTICIPANT/);
    assert.equal(f.seals(), 0);
  });
});
