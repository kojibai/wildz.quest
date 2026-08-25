import assert from "node:assert/strict";
import test from "node:test";
import { authorizeWildsLivingWorldOperationWithIdentity } from "../src/features/play/wilds-living-world-authorization";

const DIGEST = "a".repeat(64);

test("living-world work is signed at the edge and bound to the exact operation", async () => {
  let signed = "";
  const result = await authorizeWildsLivingWorldOperationWithIdentity("key:bee", {
    operationId: "operation:grove:gather:1",
    planDigest: DIGEST,
    semanticIdempotencyKey: "grove:gather:1",
    amountPhiMicro: "1250"
  }, {
    loadIdentity: async () => ({
      artifact: "receiz-id-artifact",
      artifactDigest: "b".repeat(64),
      keyId: "key:bee",
      sign: async (challengeB64Url) => {
        signed = challengeB64Url;
        return { keyId: "key:bee", signatureB64Url: "signed" } as never;
      }
    }),
    createChallenge: (input) => ({
      challengeB64Url: `challenge:${input.consentStatementDigest}`,
      challenge: { consent: { statementDigest: input.consentStatementDigest } }
    }) as never
  });

  assert.equal(result.artifact, "receiz-id-artifact");
  assert.equal(result.challenge.consent.statementDigest.length, 64);
  assert.equal(signed, `challenge:${result.challenge.consent.statementDigest}`);
  assert.deepEqual(result.requestedRails, ["settlement"]);
});

test("zero-Phi care proves source authority without asking for a settlement rail", async () => {
  let scopes: readonly string[] = ["unexpected"];
  const result = await authorizeWildsLivingWorldOperationWithIdentity("key:bee", {
    operationId: "operation:grove:water:1",
    planDigest: DIGEST,
    semanticIdempotencyKey: "grove:water:1",
    amountPhiMicro: "0"
  }, {
    loadIdentity: async () => ({
      artifact: "receiz-id-artifact",
      artifactDigest: "b".repeat(64),
      keyId: "key:bee",
      sign: async () => ({ keyId: "key:bee", signatureB64Url: "signed" }) as never
    }),
    createChallenge: (input) => {
      scopes = input.scopes;
      return {
        challengeB64Url: "challenge",
        challenge: { consent: { statementDigest: input.consentStatementDigest } }
      } as never;
    }
  });

  assert.deepEqual(scopes, []);
  assert.deepEqual(result.requestedRails, []);
});
