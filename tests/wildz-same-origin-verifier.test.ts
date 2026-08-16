import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { DocumentVerifyResponse } from "@receiz/sdk";
import {
  openWildzArtifactSameOrigin,
  verifyWildzArtifactSameOrigin
} from "../src/lib/receiz/wildz-same-origin-verifier";

test("v119 artifact opening returns only SDK-admitted payload and continuity coordinates", async () => {
  const artifactBytes = new TextEncoder().encode("sealed-artifact");
  const payloadBytes = new TextEncoder().encode("verified-payload");
  let header = "";
  const admitted = await openWildzArtifactSameOrigin({
    bytes: artifactBytes,
    mimeType: "application/vnd.receiz.artifact",
    name: "proof.receized"
  }, async (_input, init) => {
    header = new Headers(init?.headers).get("x-wildz-artifact-open") ?? "";
    return new Response(JSON.stringify({
      artifactSha256: "a".repeat(64),
      payloadSha256: "b".repeat(64),
      payloadBase64Url: Buffer.from(payloadBytes).toString("base64url"),
      filename: "proof.receized",
      mimeType: "application/json",
      ownerReceizId: "keeper.receiz.id",
      claimId: "claim-v108",
      verifyPath: "/v/claim-v108",
      recordId: "record-v108",
      compatibility: "current-native"
    }), { status: 200, headers: { "content-type": "application/json" } });
  });

  assert.equal(header, "v119");
  assert.deepEqual(admitted.artifactBytes, artifactBytes);
  assert.deepEqual(admitted.payloadBytes, payloadBytes);
  assert.equal(admitted.recordId, "record-v108");
  assert.equal("payloadBase64Url" in admitted, false);
});

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
  const headers = new Headers(requestInit?.headers);
  assert.equal(headers.get("x-wildz-proof-login"), "vault");
  assert.equal(headers.get("content-type"), "image/png");
  assert.equal(headers.get("x-wildz-artifact-filename"), "wildz-vault.receized.png");
  assert.deepEqual(new Uint8Array(requestInit?.body as Uint8Array), new TextEncoder().encode("vault"));
  assert.deepEqual(result, expected);
});

test("the player Vault coordinator never calls the cross-origin SDK verifier", () => {
  const source = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");

  assert.match(source, /verifyWildzArtifactSameOrigin/);
  assert.doesNotMatch(source, /verifier:\s*\{\s*verifyArtifact:\s*\(file\)\s*=>\s*receizCommerceAdapter\.verifyArtifact/);
});
