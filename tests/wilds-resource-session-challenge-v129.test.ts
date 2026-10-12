import assert from "node:assert/strict";
import {test} from "node:test";
import {createReceizIdentityKeyFile, createReceizProofAuthorityChallenge, sha256ReceizBytes, signReceizIdentityLoginProof, verifyReceizIdentityLoginProof, type ReceizProofAuthorityV123} from "@receiz/sdk";
import {createWildsResourceSessionChallengeV129} from "../src/lib/receiz/wilds-resource-source-client-v128";

test("session opening signs a fresh nonce under the same registered grant and consent", async () => {
  const {keyFile}=await createReceizIdentityKeyFile({owner:{uid:"session_challenge_fixture",username:"session_challenge_fixture",displayName:"Fixture"}});
  const applicationId="rc_PtuBxB_Gbm9OkFeflZiwCz-d", artifactDigest=await sha256ReceizBytes(new TextEncoder().encode("public synthetic identity coordinate"));
  const created=createReceizProofAuthorityChallenge({applicationId,artifactDigest,scopes:["receiz:subjects.write","receiz:domains.write"],consentStatementDigest:"c".repeat(64),ttlPulses:60});
  const proof=await signReceizIdentityLoginProof({keyFile,challengeB64Url:created.challengeB64Url});
  const signedGrantChallenge={...created.challenge,proof};
  const grant={applicationId,artifactDigest,keyId:keyFile.keyId,grantedScopes:["receiz:subjects.write","receiz:domains.write"],nonce:created.challenge.nonce} satisfies Pick<ReceizProofAuthorityV123,"applicationId"|"artifactDigest"|"keyId"|"grantedScopes"|"nonce">;
  const session=await createWildsResourceSessionChallengeV129({keyFile,grant,signedGrantChallenge});
  assert.notEqual(session.nonce,signedGrantChallenge.nonce);
  assert.equal(session.audience,applicationId);
  assert.equal(session.consent.statementDigest,created.challenge.consent.statementDigest);
  assert.equal(await verifyReceizIdentityLoginProof({keyFile,...session.proof}),true);
});

test("a foreign key or application cannot sign the current session challenge", async () => {
  const {keyFile}=await createReceizIdentityKeyFile({owner:{uid:"session_binding_fixture",username:"session_binding_fixture",displayName:"Fixture"}});
  const created=createReceizProofAuthorityChallenge({applicationId:"rc_PtuBxB_Gbm9OkFeflZiwCz-d",artifactDigest:"a".repeat(64),scopes:["receiz:subjects.write"],consentStatementDigest:"c".repeat(64),ttlPulses:60});
  const proof=await signReceizIdentityLoginProof({keyFile,challengeB64Url:created.challengeB64Url});
  const signedGrantChallenge={...created.challenge,proof};
  const grant={applicationId:created.challenge.audience,artifactDigest:"a".repeat(64),keyId:keyFile.keyId,grantedScopes:["receiz:subjects.write"],nonce:created.challenge.nonce} satisfies Pick<ReceizProofAuthorityV123,"applicationId"|"artifactDigest"|"keyId"|"grantedScopes"|"nonce">;
  await assert.rejects(createWildsResourceSessionChallengeV129({keyFile,grant:{...grant,keyId:"b".repeat(64)},signedGrantChallenge}),/identity_mismatch/);
  await assert.rejects(createWildsResourceSessionChallengeV129({keyFile,grant:{...grant,applicationId:"foreign-client"},signedGrantChallenge}),/identity_mismatch/);
});
