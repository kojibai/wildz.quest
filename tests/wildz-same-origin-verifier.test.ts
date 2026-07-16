import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { DocumentVerifyResponse } from "@receiz/sdk";
import { verifyWildzArtifactSameOrigin } from "../src/lib/receiz/wildz-same-origin-verifier";

test("Vault proof verification uses the working same-origin Wildz proxy", async () => {
  const expected = {
    ok: true,
    kind: "proof_object",
    errors: [],
    warnings: []
  } as unknown as DocumentVerifyResponse;
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  const result = await verifyWildzArtifactSameOrigin(
    new Blob(["vault"], { type: "image/png" }),
    async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify(expected), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  );

  assert.equal(requestUrl, "/api/document-verify");
  assert.equal(requestInit?.method, "POST");
  assert.equal(requestInit?.credentials, "same-origin");
  assert.equal(requestInit?.cache, "no-store");
  assert.equal(new Headers(requestInit?.headers).get("x-wildz-proof-login"), "vault");
  assert.ok(requestInit?.body instanceof FormData);
  assert.ok(requestInit.body.get("file") instanceof Blob);
  assert.deepEqual(result, expected);
});

test("the player Vault coordinator never calls the cross-origin SDK verifier", () => {
  const source = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");

  assert.match(source, /verifyWildzArtifactSameOrigin/);
  assert.doesNotMatch(source, /verifier:\s*\{\s*verifyArtifact:\s*\(file\)\s*=>\s*receizCommerceAdapter\.verifyArtifact/);
});
