import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWildsPortableClaim } from "../src/features/play/wilds-portable-claim.js";
import { executeWildsPortableClaim, prepareWildsPortableClaimAuthoritySession } from "../src/lib/receiz/wilds-portable-claim-runtime.js";
import { wildsPortableClaimConsentStatementDigest } from "../src/features/play/wilds-portable-claim-consent.js";

const digest = (character: string) => character.repeat(64);

function fixture() {
  const operationPlan = {
    schema: "receiz.operation-plan.v124",
    applicationId: "wildz",
    domainId: "wildz:inventory:kai",
    operationKind: "receiz.atomic-operation.v124",
    exactPlanDigest: digest("c"),
    semanticIdempotencyKey: "wildz-claim:resource:one",
    attemptId: "attempt-one"
  };
  const transitionSet = {
    schema: "receiz.portable-execution-transition-set.v124",
    applicationId: "wildz",
    exactPlanDigest: digest("c"),
    expectedParticipantHeads: { "wildz:inventory:kai": digest("a") },
    proposedParticipantHeads: { "wildz:inventory:kai": digest("d") },
    members: [],
    authority: { transitionSetIsProofAuthority: false, committed: false, strongerTruth: "sealed-receiz-proof-object" }
  };
  const claim = createWildsPortableClaim({
    kind: "resource",
    title: "12 moonwood",
    source: { ownerReceizId: "receiz:kai", subjectId: "wildz:inventory:kai", head: digest("a"), proofObjectDigest: digest("b") },
    recipient: { handle: "nova" },
    issuedAtKai: 42,
    expiresAtKai: 542,
    carrier: { kind: "portable-execution", exactPlanDigest: digest("c"), transitionSet }
  });
  return { claim, operationPlan, transitionSet };
}

describe("portable claim execution", () => {
  it("prepares recipient source authority without waiting for global publication", async () => {
    const { claim } = fixture();
    const consent = await wildsPortableClaimConsentStatementDigest({ claimId: claim.claimId, exactPlanDigest: claim.carrier.kind === "portable-execution" ? claim.carrier.exactPlanDigest : "", kind: claim.kind });
    let published = false;
    const prepared = await prepareWildsPortableClaimAuthoritySession({
      claim,
      actor: { playerId: "nova", handle: "nova", receizActorId: "nova", accessToken: "token", practice: false },
      executionProof: { artifact: "identity", challenge: { consent: { statementDigest: consent } }, requestedRails: [] },
      rail: {
        subjectStateV122: async () => ({ schema: "receiz.subject.state.v122", subjectId: "nova", ownerReceizId: "nova", head: digest("e"), stateDigest: digest("f"), registryDigest: digest("1"), reducerDigest: digest("2"), proofObjectId: "proof:nova", admittedProofDigest: digest("3"), genesisHead: digest("4") }),
        client: { assets: { createProofObject: async () => ({}) } },
        publishSealedSourceV124: async () => { published = true; await new Promise(() => undefined); }
      } as never,
      sealSource: async () => ({ schema: "receiz.sealed-artifact-bytes.v124", exactBytesB64u: "cHJvb2Y", filename: "nova.receiz", mimeType: "application/receiz+json", artifactSha256: digest("5"), payloadSha256: digest("6") })
    });
    assert.equal(prepared.actorSubjectId, "nova");
    assert.equal(prepared.subjectSourceArtifact.artifactSha256, digest("5"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(published, true);
  });

  it("admits the carried source and commits through the recipient Receiz ID once", async () => {
    const { claim, operationPlan } = fixture();
    const calls: string[] = [];
    const committed = {
      schema: "receiz.execution-outcome.v124",
      status: "committed",
      applicationId: "wildz",
      domainId: operationPlan.domainId,
      operationKind: operationPlan.operationKind,
      exactPlanDigest: operationPlan.exactPlanDigest,
      semanticIdempotencyKey: operationPlan.semanticIdempotencyKey,
      attemptId: operationPlan.attemptId,
      committedHeads: { "wildz:inventory:kai": digest("d") },
      executionId: "execution-one"
    };
    const result = await executeWildsPortableClaim({
      claim,
      currentKai: 100,
      authority: { accessToken: "token", ownerReceizId: "receiz:nova", actorId: "receiz:nova", profileHandle: "nova" },
      authoritySessionInput: { sourceArtifact: "recipient-proof" },
      verifyTransitionSet: async () => ({
        status: "verified-portable-execution-transition-set",
        operationPlan,
        expectedParticipantHeads: { "wildz:inventory:kai": digest("a") },
        proposedParticipantHeads: { "wildz:inventory:kai": digest("d") },
        members: [],
        authority: { transitionSetIsProofAuthority: false, committed: false, strongerTruth: "sealed-receiz-proof-object" }
      } as never),
      rail: {
        openAuthoritySessionV124: async () => { calls.push("open"); return { authoritySessionHandle: "session" }; },
        stagePreparedExecutionV124: async () => { calls.push("stage"); return { executionId: "execution-one" }; },
        executeV124: async () => { calls.push("execute"); return committed; },
        resolveExecutionByIdempotencyV124: async () => { calls.push("resolve"); return committed; },
        closeAuthoritySessionV124: async () => { calls.push("close"); return {}; }
      } as never
    });
    assert.equal(result.status, "committed");
    assert.equal(result.claimId, claim.claimId);
    assert.deepEqual(calls, ["open", "stage", "execute", "close"]);
  });

  it("rejects the wrong recipient and an expired claim before opening a rail", async () => {
    const { claim } = fixture();
    const never = async () => { throw new Error("rail_must_not_run"); };
    const common = {
      claim,
      authoritySessionInput: {},
      verifyTransitionSet: never,
      rail: {
        openAuthoritySessionV124: never,
        stagePreparedExecutionV124: never,
        executeV124: never,
        resolveExecutionByIdempotencyV124: never,
        closeAuthoritySessionV124: never
      } as never
    };
    await assert.rejects(() => executeWildsPortableClaim({ ...common, currentKai: 100, authority: { accessToken: "token", ownerReceizId: "receiz:sol", actorId: "receiz:sol", profileHandle: "sol" } }), /wilds_portable_claim_recipient_mismatch/);
    await assert.rejects(() => executeWildsPortableClaim({ ...common, currentKai: 600, authority: { accessToken: "token", ownerReceizId: "receiz:nova", actorId: "receiz:nova", profileHandle: "nova" } }), /wilds_portable_claim_expired/);
  });
});
