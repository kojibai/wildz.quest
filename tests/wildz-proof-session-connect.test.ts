import assert from "node:assert/strict";
import { test } from "node:test";
import { connectWildzProofSession } from "../src/lib/receiz/wildz-identity-adapter";
import type { WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";

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
