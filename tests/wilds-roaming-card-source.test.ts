import assert from "node:assert/strict";
import { test } from "node:test";
import { receizBase64UrlEncode, type ReceizOpenedArtifact, type ReceizSealedArtifact } from "@receiz/sdk";
import { embedPortableCardInPng, embedPortableVaultInPng } from "../src/features/play/card-export";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { createWildsRoamingCardSourcePreparer, verifyWildsRoamingCardPayload } from "../src/lib/receiz/wilds-roaming-card-source";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
const asset = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "roaming-native-source", capturedAt: "2026-07-15T21:00:00.000Z" });
const cardPng = embedPortableCardInPng(png, asset);
const actor = { actorId: "keeper", profileHandle: "keeper.receiz.id", receizUserId: "keeper-user" };
const sha = async (bytes: Uint8Array) => Buffer.from(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)).toString("hex");

async function fixture() {
  const rows = new Map<string, { artifact: { schema: "receiz.sealed-artifact-bytes.v124"; exactBytesB64u: string; filename: string; mimeType: string; artifactSha256: string; payloadSha256: string }; predecessors: string[] }>();
  const opened = new Map<string, ReceizOpenedArtifact>();
  let creates = 0;
  async function seal(payload: Uint8Array, owner = actor.profileHandle, ancestors: string[] = []) {
    const bytes = new TextEncoder().encode(`native-${opened.size}-${owner}`);
    const digest = await sha(bytes), payloadSha256 = await sha(payload);
    const artifact = { kind: "receiz.native-record-seal", artifact: new Blob([bytes.slice().buffer]), filename: "card.receiz", mimeType: "application/vnd.receiz.artifact",
      artifactSha256: digest, payloadSha256,
      continuity: { carrier: "native-record-seal", ownerReceizId: owner, recordId: `record-${digest}`, claimId: `claim-${digest}`, verifyPath: `/v/${digest}`, signatureVersion: 4 },
      verification: { ok: true, integrity: { ok: true, errors: [] }, errors: [], warnings: [], kind: "bundle", bundle: {},
        assetContinuity: { history: ancestors.map(sourceArtifactSha256 => ({ sourceArtifactSha256 })) } }
    } as unknown as ReceizSealedArtifact;
    opened.set(digest, { sealedArtifact: artifact, verifiedPayload: { bytes: payload, sha256: payloadSha256, mimeType: "image/png", filename: "card.png" },
      verification: artifact.verification, legacyCompatibility: "current-native" } as unknown as ReceizOpenedArtifact);
    return artifact;
  }
  const client = {
    assets: { async createProofObject(input) { creates++; return seal(input.payload.bytes); } },
    artifacts: {
      async verifyAndOpen(file: Blob) { const result = opened.get(await sha(new Uint8Array(await file.arrayBuffer()))); if (!result) throw new Error("invalid artifact"); return result; },
      async download(artifact: ReceizSealedArtifact) { return { ok: true, filename: artifact.filename, mimeType: artifact.mimeType, size: artifact.artifact.size, artifactSha256: artifact.artifactSha256 }; }
    }
  } satisfies Parameters<typeof createWildsRoamingCardSourcePreparer>[0]["client"];
  const sources = {
    async locateAsset() { return { artifactSha256s: [...rows.keys()].reverse(), nextCursor: null }; },
    async read(digest: string) { return rows.get(digest) ?? null; },
    async retain(input: { bytes: Uint8Array; filename: string; mimeType: string; assetId?: string }) {
      const digest = await sha(input.bytes), value = opened.get(digest)!;
      const artifact = { schema: "receiz.sealed-artifact-bytes.v124" as const, exactBytesB64u: receizBase64UrlEncode(input.bytes), filename: input.filename,
        mimeType: input.mimeType, artifactSha256: digest, payloadSha256: value.sealedArtifact.payloadSha256 };
      rows.set(digest, { artifact, predecessors: [] }); return artifact;
    }
  };
  async function retain(artifact: ReceizSealedArtifact) { await sources.retain({ bytes: new Uint8Array(await artifact.artifact.arrayBuffer()), filename: artifact.filename, mimeType: artifact.mimeType, assetId: asset.id }); }
  return { client, sources, seal, retain, creates: () => creates };
}

test("native preparation seals one exact card once, persists bytes, and reopens them on another controller", async () => {
  const f = await fixture();
  const prepare = createWildsRoamingCardSourcePreparer(f);
  const input = { actor, asset, initialCardPng: { bytes: cardPng, filename: "mintcub.png" } };
  const [a, b] = await Promise.all([prepare(input), prepare(input)]);
  assert.equal(a, b);
  assert.equal(a.reused, false);
  assert.equal(f.creates(), 1);
  const restored = await createWildsRoamingCardSourcePreparer(f)({ actor, asset });
  assert.equal(restored.reused, true);
  assert.deepEqual(restored.admitted.artifactBytes, a.admitted.artifactBytes);
  assert.equal(f.creates(), 1);
});

test("captured source uses SDK current owner despite original owner in immutable card", async () => {
  const f = await fixture();
  await f.retain(await f.seal(cardPng, "new_keeper.receiz.id"));
  const prepare = createWildsRoamingCardSourcePreparer(f);
  const result = await prepare({ actor: { ...actor, profileHandle: "new_keeper.receiz.id", actorId: "new_keeper" }, asset });
  assert.equal(result.admitted.ownerReceizId, "new_keeper.receiz.id");
  await assert.rejects(prepare({ actor, asset, initialCardPng: { bytes: cardPng, filename: "card.png" } }), /owner_mismatch/);
  assert.equal(f.creates(), 0);
});

test("carried ownership descendant wins over index order; independent native siblings fail closed", async () => {
  const f = await fixture();
  const first = await f.seal(cardPng), next = await f.seal(cardPng, "next.receiz.id", [first.artifactSha256]);
  await f.retain(next); await f.retain(first);
  const prepare = createWildsRoamingCardSourcePreparer(f);
  assert.equal((await prepare({ actor: { ...actor, profileHandle: "next.receiz.id" }, asset })).admitted.artifactSha256, next.artifactSha256);
  await f.retain(await f.seal(cardPng));
  await assert.rejects(prepare({ actor, asset }), /history_conflict/);
  assert.equal(f.creates(), 0);
});

test("a changed exact card cannot reseal over retained custody", async () => {
  const f = await fixture();
  await f.retain(await f.seal(cardPng));
  const changed = { ...asset, status: "verified" as const };
  // status is outside the immutable base proof, but belongs to the complete fingerprint.
  const prepare = createWildsRoamingCardSourcePreparer(f);
  await assert.rejects(prepare({ actor, asset: changed, initialCardPng: { bytes: cardPng, filename: "card.png" } }), /card_(mismatch|invalid)/);
  assert.equal(f.creates(), 0);
});

test("Vault payloads and appended private trailers are rejected before native creation", async () => {
  const f = await fixture(), prepare = createWildsRoamingCardSourcePreparer(f);
  const vault = embedPortableVaultInPng(cardPng, [asset]);
  assert.throws(() => verifyWildsRoamingCardPayload(vault, asset), /not_single_card/);
  const trailer = new Uint8Array(cardPng.length + 3); trailer.set(cardPng); trailer.set([1, 2, 3], cardPng.length);
  await assert.rejects(prepare({ actor, asset, initialCardPng: { bytes: trailer, filename: "card.png" } }), /not_single_card/);
  assert.equal(f.creates(), 0);
});

test("missing retained bytes never trigger replacement creation", async () => {
  const f = await fixture();
  const prepare = createWildsRoamingCardSourcePreparer({ ...f, sources: { ...f.sources,
    locateAsset: async () => ({ artifactSha256s: ["a".repeat(64)], nextCursor: null }) } });
  await assert.rejects(prepare({ actor, asset, initialCardPng: { bytes: cardPng, filename: "card.png" } }), /source_missing/);
  assert.equal(f.creates(), 0);
});

test("a retained native Vault is never exposed or converted to a fresh single-card identity", async () => {
  const f = await fixture();
  await f.retain(await f.seal(embedPortableVaultInPng(cardPng, [asset])));
  await assert.rejects(createWildsRoamingCardSourcePreparer(f)({ actor, asset, initialCardPng: { bytes: cardPng, filename: "card.png" } }), /not_single_card/);
  assert.equal(f.creates(), 0);
});

test("failed native verification does not masquerade as skippable document history", async () => {
  const f = await fixture();
  await f.retain(await f.seal(cardPng));
  const client = { ...f.client, artifacts: { ...f.client.artifacts, verifyAndOpen: async () => { throw new Error("corrupt native source"); } } };
  await assert.rejects(createWildsRoamingCardSourcePreparer({ sources: f.sources, client })({ actor, asset, initialCardPng: { bytes: cardPng, filename: "card.png" } }), /wildz_artifact_verification_failed/);
  assert.equal(f.creates(), 0);
});

 test("living card source binds its full append to its immutable base card", () => {
  const living = admitLegacyCard(asset, "2026-07-15T22:00:00.000Z");
  const payload = embedPortableCardInPng(png, living);
  assert.doesNotThrow(() => verifyWildsRoamingCardPayload(payload, living));
  assert.throws(() => verifyWildsRoamingCardPayload(payload, asset), /card_mismatch/);
});
