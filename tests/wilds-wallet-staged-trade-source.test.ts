import assert from "node:assert/strict";
import test from "node:test";
import {
  createReceizIdIdentity, createReceizIdentityKeyFile, receizBase64UrlEncode,
  serializeReceizIdentityArtifact, signReceizIdentityLoginProof, verifyReceizIdentityLoginProof,
  verifyReceizIdentityPortableStateProof, sha256ReceizBytes, createReceizClient,
} from "@receiz/sdk";
import { createSafeWildsWalletStagedTradeIdentityExport, verifyWildsWalletStagedTradeIdentityApproval } from "../src/features/play/wallet/wilds-wallet-staged-trade-identity";
import { createWildsWalletStagedTradePlan, wildsWalletStagedTradeApprovalChallenge } from "../src/features/play/wallet/wilds-wallet-staged-trade-types";
import { createWildsWalletTradeAgreement, createWildsWalletTradeDraft } from "../src/features/play/wallet/wilds-wallet-trade";

function plan() {
  const draft = (sender: string, recipient: string) => createWildsWalletTradeDraft({ attemptId: `trade:${sender}`, recipient, selfHandle: sender, phiMicro: "1", requestedPhiMicro: "1", requestNote: "Each leg settles separately", selections: [] });
  return createWildsWalletStagedTradePlan(createWildsWalletTradeAgreement({ senderHandle: "alice", draft: draft("alice", "bob") }, { senderHandle: "bob", draft: draft("bob", "alice") }));
}

test("public trade identity export keeps the same SDK key and exact signed account, with no plaintext private key", async () => {
  const identity = await createReceizIdIdentity({ username: "alice", displayName: "Alice" });
  const before = serializeReceizIdentityArtifact(identity.keyFile);
  const safe = await createSafeWildsWalletStagedTradeIdentityExport(identity.keyFile);
  assert.equal(safe.keyId, identity.keyFile.keyId);
  assert.deepEqual(safe.owner, identity.keyFile.owner);
  assert.equal(safe.crypto.publicKeyRawB64u, identity.keyFile.crypto.publicKeyRawB64u);
  assert.deepEqual(safe.portableState, identity.keyFile.portableState);
  assert.equal(await verifyReceizIdentityPortableStateProof(safe), "verified");
  assert.equal(Boolean(safe.crypto.privateKeyPkcs8B64u), false);
  assert.ok(safe.crypto.privateKeyPkcs8CiphertextB64u);
  assert.equal(serializeReceizIdentityArtifact(safe).includes(identity.keyFile.crypto.privateKeyPkcs8B64u!), false);
  assert.equal(serializeReceizIdentityArtifact(identity.keyFile), before);
  const p = plan(), binding = { ownerHandle: "alice.receiz.id", keyId: identity.keyFile.keyId, identityArtifactDigest: "a".repeat(64) };
  const challenge = wildsWalletStagedTradeApprovalChallenge(p, binding);
  const signature = await signReceizIdentityLoginProof({ keyFile: identity.keyFile, challengeText: challenge.exactChallenge });
  assert.equal(await verifyReceizIdentityLoginProof({ keyFile: safe, challengeB64Url: signature.challengeB64Url, signatureB64Url: signature.signatureB64Url }), true);
  const changed = receizBase64UrlEncode(new TextEncoder().encode(challenge.exactChallenge.replace('"amountPhiMicro":"1"', '"amountPhiMicro":"2"')));
  assert.notEqual(changed, signature.challengeB64Url);
  assert.equal(await verifyReceizIdentityLoginProof({ keyFile: safe, challengeB64Url: changed, signatureB64Url: signature.signatureB64Url }), false);
});

test("unsigned or altered account state cannot become a public peer identity source", async () => {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "fixture", username: "alice" } });
  await assert.rejects(createSafeWildsWalletStagedTradeIdentityExport(keyFile), /signed account state/);
  const identity = await createReceizIdIdentity({ username: "alice" });
  const mutated = structuredClone(identity.keyFile);
  (mutated.portableState!.snapshot as any).account.username = "bob";
  await assert.rejects(createSafeWildsWalletStagedTradeIdentityExport(mutated), /signed account state/);
});

test("an actual device signature on raw JSON is insufficient without the independent SDK-sealed Original", async () => {
  const identity = await createReceizIdIdentity({ username: "alice" });
  const safe = await createSafeWildsWalletStagedTradeIdentityExport(identity.keyFile);
  const bytes = new TextEncoder().encode(serializeReceizIdentityArtifact(safe)), digest = await sha256ReceizBytes(bytes);
  const p = plan(), binding = { ownerHandle: "alice.receiz.id", keyId: safe.keyId, identityArtifactDigest: digest };
  const challenge = wildsWalletStagedTradeApprovalChallenge(p, binding);
  const proof = await signReceizIdentityLoginProof({ keyFile: identity.keyFile, challengeText: challenge.exactChallenge });
  await assert.rejects(verifyWildsWalletStagedTradeIdentityApproval({ schema: "wildz.wallet.staged-trade-approval.v1", tradeId: p.tradeId, approvalId: challenge.approvalId, ...binding, sourceHeads: [],
    evidence: { schema: "wildz.wallet.staged-trade-identity-proof.v1", proof, original: { schema: "receiz.sealed-artifact-bytes.v124", exactBytesB64u: receizBase64UrlEncode(bytes), filename: "public-key.json", mimeType: "application/json", artifactSha256: digest, payloadSha256: digest } } }, p), /Original could not be verified/);
});


test("released default SDK cannot provide historical bearer status authority", async () => {
  const client = createReceizClient({ accessToken: "fixture-token" });
  await assert.rejects(client.bearer.transferStatus("fixture"), /RECEIZ_V120_LOCAL_RUNTIME_OR_EXPLICIT_HTTP_TRANSPORT_REQUIRED/);
  await assert.rejects(client.subjects.history("fixture"), /RECEIZ_V120_LOCAL_RUNTIME_OR_EXPLICIT_HTTP_TRANSPORT_REQUIRED/);
});
