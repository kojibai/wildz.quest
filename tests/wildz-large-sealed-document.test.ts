import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256ReceizBytes } from "@receiz/sdk";
import type { verifyReceizOfflineSealedFile } from "@receiz/sdk/offline";
import { openWildzLargeSealedPngDocument } from "../src/lib/receiz/wildz-large-sealed-document";
import { openWildzSealedDocument } from "../src/lib/receiz/wildz-sealed-document";
import { withWildzPngPayloadChunk } from "../src/features/play/card-export";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
type Verdict = Awaited<ReturnType<typeof verifyReceizOfflineSealedFile>>;
const validResult = async (): Promise<Verdict> => ({ ok: true, kind: "png", integrity: { ok: true, errors: [] }, errors: [], warnings: [], anchor: null, package: null, assetContinuity: { state: "not_applicable" }, bundle: { artifactSha256Basis: await sha256ReceizBytes(png) } });

test("large document transport requires successful SDK integrity, no native custody, and exact binding", async () => {
  const valid = await validResult();
  const open = (result: Verdict) => openWildzLargeSealedPngDocument({ bytes: png }, async () => result);
  const opened = await open(valid);
  assert.deepEqual(opened.payloadBytes, png);
  assert.equal(opened.sealedArtifactSha256, await sha256ReceizBytes(png));
  await assert.rejects(open({ ...valid, ok: false }), /verification_failed/);
  await assert.rejects(open({ ...valid, integrity: { ok: false, errors: [] } }), /verification_failed/);
  await assert.rejects(open({ ...valid, errors: ["bad proof"] }), /verification_failed/);
  await assert.rejects(open({ ...valid, assetContinuity: undefined }), /native_custody_required/);
  await assert.rejects(open({ ...valid, bundle: { ...valid.bundle, nativeRecordSeal: {} } }), /native_custody_required/);
  await assert.rejects(open({ ...valid, bundle: { artifactSha256Basis: "0".repeat(64) } }), /binding_invalid/);
  await assert.rejects(openWildzLargeSealedPngDocument({ bytes: new Uint8Array([...png, 1]) }, async () => valid), /unbound_trailer/);
});

test("above-limit PNGs still require a real canonical seal", async () => {
  const unsealed = withWildzPngPayloadChunk(png, "large.fixture", "x".repeat(17 * 1024 * 1024));
  await assert.rejects(openWildzSealedDocument({ bytes: unsealed, mimeType: "image/png" }), /wildz_artifact_verification_failed:invalid/);
});

test("document retention rejects unverified bytes without creating native source custody", async () => {
  const { createWildzSealedDocumentStore } = await import("../src/lib/receiz/wildz-sealed-document-store");
  const { createMemoryWildzContinuityDatabase } = await import("./support/memory-wildz-continuity-database");
  const database = createMemoryWildzContinuityDatabase();
  await assert.rejects(createWildzSealedDocumentStore(database).retain({ bytes: png, filename: "unsealed.png", mimeType: "image/png" }), /verification_failed/);
  assert.deepEqual(database.dump().artifacts, []);
});
