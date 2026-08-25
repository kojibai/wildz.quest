import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeWildsPortableClaimWithIdentity } from "../src/features/play/wilds-portable-claim-authorization.js";
import { wildsPortableClaimConsentStatementDigest } from "../src/features/play/wilds-portable-claim-consent.js";

const digest = (character: string) => character.repeat(64);

describe("portable claim edge authorization", () => {
  it("signs the exact claim and requests settlement only for Phi", async () => {
    const challenges: unknown[] = [];
    const dependencies = {
      loadIdentity: async () => ({
        artifact: "identity-artifact",
        artifactDigest: digest("a"),
        keyId: "key-one",
        sign: async (challengeB64Url: string) => ({ schema: "proof", challengeB64Url }) as never
      }),
      createChallenge: (input: unknown) => {
        challenges.push(input);
        return { challengeB64Url: "challenge", challenge: { consent: { statementDigest: "bound" } } } as never;
      }
    };
    const request = { claimId: `wildz-claim:${digest("b")}`, exactPlanDigest: digest("c"), kind: "phi" as const };
    const authorization = await authorizeWildsPortableClaimWithIdentity("key-one", request, dependencies);
    assert.equal(authorization.artifact, "identity-artifact");
    assert.deepEqual(authorization.requestedRails, ["settlement"]);
    assert.equal(challenges.length, 1);
    assert.match(await wildsPortableClaimConsentStatementDigest(request), /^[a-f0-9]{64}$/);
  });

  it("does not request a value rail for custody or access claims", async () => {
    const scopes: unknown[] = [];
    const authorization = await authorizeWildsPortableClaimWithIdentity("key-one", {
      claimId: `wildz-claim:${digest("b")}`,
      exactPlanDigest: digest("c"),
      kind: "resource"
    }, {
      loadIdentity: async () => ({ artifact: "identity", artifactDigest: digest("a"), keyId: "key-one", sign: async () => ({}) as never }),
      createChallenge: (input: { scopes: unknown }) => { scopes.push(input.scopes); return { challengeB64Url: "challenge", challenge: {} } as never; }
    });
    assert.deepEqual(authorization.requestedRails, []);
    assert.deepEqual(scopes, [[]]);
  });
});
