import assert from "node:assert/strict";
import { test } from "node:test";
import { connectWildzProofSession } from "../src/lib/receiz/wildz-identity-adapter";
import type { WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";
import { createReceizIdIdentity, serializeReceizIdentityArtifact, verifyReceizIdentityLoginProof } from "@receiz/sdk";

const session: WildzIdentitySession = {
  schema: "receiz.wildz.identity_session.v1", keyId: "synthetic-connect-key", actorId: "keeper",
  username: "keeper", displayName: "Keeper", portableStateStatus: "verified",
  localAuthority: "verified", remoteStatus: "offline"
};

test("unavailable or malformed sync challenges never open the durable Identity Seal", async () => {
  const nativeFetch = globalThis.fetch;
  const nativeIndexedDB = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  let opens = 0, challenges = 0;
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: {
    open() { opens++; throw new Error("test_identity_read_unnecessary"); }
  } });
  try {
    for (const mode of ["offline", "unavailable", "malformed"] as const) {
      globalThis.fetch = async input => {
        if (String(input).endsWith("/challenge")) {
          challenges++;
          if (mode === "offline") throw new Error("test_transport_offline");
          return Response.json(mode === "malformed" ? {} : { error: "unavailable" }, { status: mode === "unavailable" ? 503 : 200 });
        }
        return Response.json({ status: "offline" });
      };
      await assert.rejects(connectWildzProofSession(session), mode === "offline" ? /test_transport_offline/ : /wildz_proof_challenge_unavailable/);
    }
    assert.equal(challenges, 3);
    assert.equal(opens, 0);
    // A real challenge still requires the actual local key. No held identity
    // flag or unavailable storage may create a signed distribution session.
    globalThis.fetch = async () => Response.json({ ok: true, nonceB64Url: "A".repeat(32) });
    await assert.rejects(connectWildzProofSession(session), /test_identity_read_unnecessary/);
    assert.equal(opens, 1);
  } finally {
    globalThis.fetch = nativeFetch;
    if (nativeIndexedDB) Object.defineProperty(globalThis, "indexedDB", nativeIndexedDB);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  }
});

test("background distribution signs with the small worker key without reading the imported archive on the main thread", async () => {
  const identity = await createReceizIdIdentity({ username: "keeper", displayName: "Keeper" });
  const current = { ...session, keyId: identity.keyFile.keyId };
  const nativeFetch = globalThis.fetch;
  const descriptors = ["Worker", "indexedDB"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  let keyRequests = 0, mainReads = 0, stopped = 0;
  let continuation: Record<string, string> | null = null;
  class SigningWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror = null;
    onmessageerror = null;
    postMessage(value: unknown) {
      assert.deepEqual(value, { command: "signing-key", keyId: current.keyId });
      keyRequests++;
      queueMicrotask(() => this.onmessage?.({ data: { ok: true, text: serializeReceizIdentityArtifact({ ...identity.keyFile, portableState: null }) } }));
    }
    terminate() { stopped++; }
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: SigningWorker });
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: { open() { mainReads++; throw Error("main_thread_archive_read"); } } });
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/challenge")) return Response.json({ ok: true, nonceB64Url: "A".repeat(32) });
    if (init?.method === "POST") { continuation = JSON.parse(String(init.body)); return Response.json({ ok: true }); }
    return Response.json({ status: "offline" });
  };
  try {
    await connectWildzProofSession(current);
    assert.equal(mainReads, 0);
    assert.equal(keyRequests, 1);
    assert.equal(stopped, 1);
    assert.ok(continuation);
    const proof = continuation as Record<string, string>;
    assert.equal(proof.keyId, identity.keyFile.keyId);
    assert.equal(await verifyReceizIdentityLoginProof({ keyFile: identity.keyFile, challengeB64Url: proof.challengeB64Url, signatureB64Url: proof.signatureB64Url }), true);
  } finally {
    globalThis.fetch = nativeFetch;
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
