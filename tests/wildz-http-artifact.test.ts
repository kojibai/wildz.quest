import assert from "node:assert/strict";
import { test } from "node:test";
import {
  encodeWildzMultipartFile,
  readWildzHttpArtifact
} from "../src/lib/receiz/wildz-http-artifact";

test("binary card and Vault uploads preserve every source byte without FormData parsing", async () => {
  const bytes = Uint8Array.from([0, 1, 2, 13, 10, 255, 128, 42]);
  const request = new Request("https://wildz.quest/api/document-verify", {
    method: "POST",
    headers: {
      "content-type": "image/png",
      "x-wildz-artifact-filename": encodeURIComponent("old-card.receized.png")
    },
    body: bytes
  });
  const uploaded = await readWildzHttpArtifact(request, {
    fallbackFilename: "fallback.png",
    maximumBytes: 1_024
  });
  assert.deepEqual(uploaded.bytes, bytes);
  assert.equal(uploaded.filename, "old-card.receized.png");
  assert.equal(uploaded.mimeType, "image/png");
  assert.equal(uploaded.form, null);
});

test("fixed-length Receiz multipart forwarding parses back to the exact file and fields", async () => {
  const bytes = Uint8Array.from([137, 80, 78, 71, 0, 255, 10, 13]);
  const encoded = encodeWildzMultipartFile({
    bytes,
    filename: "vault.receized.png",
    mimeType: "image/png",
    fields: { visualStamp: "0" }
  });
  assert.equal(Number(encoded.headers["content-length"]), encoded.body.byteLength);
  const request = new Request("https://receiz.com/api/document-seal", {
    method: "POST",
    headers: encoded.headers,
    body: encoded.body
  });
  const form = await request.formData();
  const file = form.get("file");
  assert.ok(file instanceof File);
  assert.equal(file.name, "vault.receized.png");
  assert.equal(file.type, "image/png");
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
  assert.equal(form.get("visualStamp"), "0");
});

test("legacy multipart upload remains accepted while malformed multipart fails clearly", async () => {
  const form = new FormData();
  form.set("file", new Blob(["legacy"], { type: "image/png" }), "legacy.receized.png");
  const accepted = await readWildzHttpArtifact(new Request("https://wildz.quest/upload", {
    method: "POST",
    body: form
  }), { fallbackFilename: "fallback.png", maximumBytes: 100 });
  assert.equal(new TextDecoder().decode(accepted.bytes), "legacy");

  await assert.rejects(
    readWildzHttpArtifact(new Request("https://wildz.quest/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=broken" },
      body: "not multipart"
    }), { fallbackFilename: "fallback.png", maximumBytes: 100 }),
    /wildz_artifact_upload_malformed/
  );
});
