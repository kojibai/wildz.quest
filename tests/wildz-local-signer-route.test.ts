import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/receiz/local-signer/enroll/route";

const endpoint = "https://wildz.test/api/receiz/local-signer/enroll";
const publicProof = { publicKeyRawB64u: "a".repeat(43), challengeB64u: "b".repeat(43), challengeSigB64u: "c".repeat(86) };
const request = (body: unknown, origin = "https://wildz.test") => new Request(endpoint, {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body)
});

test("device enrollment never forwards private key fields, image payloads, or cross-origin requests", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("unexpected_upload"); };
  try {
    assert.equal((await POST(request({ ...publicProof, privateKey: "test-only-rejected" }))).status, 400);
    assert.equal((await POST(request({ payload: "test-image" }))).status, 400);
    assert.equal((await POST(request(publicProof, "https://other.test"))).status, 403);
    assert.equal((await POST(request({ ...publicProof, challengeB64u: "a".repeat(5000) }))).status, 413);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("device enrollment forwards only the public challenge proof and returns a noncached certificate", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://receiz.com/api/signer/v4/receiz/enroll");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), publicProof);
    assert.deepEqual(init?.headers, { "content-type": "application/json" });
    return Response.json({ cert: { test: "browser must still validate the certificate" }, ignored: "not forwarded" });
  };
  try {
    const response = await POST(request(publicProof));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { ok: true, cert: { test: "browser must still validate the certificate" } });
  } finally { globalThis.fetch = originalFetch; }
});
