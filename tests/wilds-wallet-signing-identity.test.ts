import assert from "node:assert/strict";
import test from "node:test";
import { createReceizIdentityKeyFile, parseReceizIdentityArtifactText, serializeReceizIdentityArtifact, verifyReceizIdentityLoginProof } from "@receiz/sdk";
import { authorizeWildsWalletReadWithIdentity } from "../src/features/play/wallet/wilds-wallet-read-authorization";
import { authorizeWildsWalletTransferWithIdentity } from "../src/features/play/wallet/wilds-wallet-transfer-authorization";
import { issueWildsWalletIdentityAuthorityChallenge } from "../src/lib/receiz/wilds-wallet-identity-authority";

test("default wallet authority reads only the worker's signing identity and still produces valid exact-edge signatures", async () => {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "wallet_worker_fixture", username: "wallet_worker_fixture", displayName: "Synthetic" }, portableState: { snapshot: { cards: [] } } });
  const text = serializeReceizIdentityArtifact({ ...keyFile, portableState: null });
  const posted: unknown[] = [];
  const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  const fetcher = globalThis.fetch;
  let completed = false;
  class SigningWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror = null;
    onmessageerror = null;
    terminate() {}
    postMessage(value: unknown) {
      posted.push(value);
      queueMicrotask(() => this.onmessage?.({ data: { ok: true, text } }));
    }
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: SigningWorker });
  globalThis.fetch = async (input, options) => {
    if (!options?.body) {
      const digest = new URL(String(input), "https://wildz.test").searchParams.get("artifactDigest")!;
      const issued = issueWildsWalletIdentityAuthorityChallenge({ session: { keyId: keyFile.keyId }, artifactDigest: digest }, "synthetic-only-test-secret");
      return Response.json(issued.challenge);
    }
    const body = JSON.parse(String(options.body));
    const identity = parseReceizIdentityArtifactText(body.artifact);
    assert.equal(identity.keyId, keyFile.keyId);
    assert.equal(identity.portableState, null, "wallet identification does not transmit the account archive");
    const proof = body.challenge.proof;
    assert.equal(await verifyReceizIdentityLoginProof({ keyFile: identity, challengeB64Url: proof.challengeB64Url, signatureB64Url: proof.signatureB64Url }), true);
    completed = true;
    return Response.json({ status: "connected", scopes: ["openid", "profile", "receiz:wallet.read"] });
  };
  try {
    assert.equal(await authorizeWildsWalletReadWithIdentity(keyFile.keyId), true);
    assert.equal(completed, true);
    const transfer = await authorizeWildsWalletTransferWithIdentity(keyFile.keyId, { attempt: "worker.exact-transfer", recipientUsername: "friend", amountPhiMicro: "1", rail: "settlement" });
    const identity = parseReceizIdentityArtifactText(transfer.artifact);
    assert.equal(identity.portableState, null);
    const proof = transfer.challenge.proof!;
    assert.equal(await verifyReceizIdentityLoginProof({ keyFile: identity, challengeB64Url: proof.challengeB64Url, signatureB64Url: proof.signatureB64Url }), true);
    assert.deepEqual(posted, Array.from({ length: 2 }, () => ({ command: "signing-key", keyId: keyFile.keyId })));
    assert.ok(keyFile.portableState, "the original durable Seal is unchanged");
  } finally {
    globalThis.fetch = fetcher;
    if (workerDescriptor) Object.defineProperty(globalThis, "Worker", workerDescriptor);
    else Reflect.deleteProperty(globalThis, "Worker");
  }
});
