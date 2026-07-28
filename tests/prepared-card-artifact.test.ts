import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cardArtifactFingerprint,
  createPreparedCardArtifactCache,
  type PreparedCardArtifact
} from "../src/features/play/prepared-card-artifact.js";
import type { PortableCardAsset } from "../src/features/play/portable-card.js";

function card(revision = 1): PortableCardAsset {
  return {
    id: "wilds:0123456789abcdef01234567",
    status: "verified",
    manifest: {
      name: "Aurelis",
      revision
    },
    proof: {
      digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  } as unknown as PortableCardAsset;
}

function artifact(asset: PortableCardAsset): PreparedCardArtifact {
  return {
    bytes: Uint8Array.from([1, 2, 3]),
    filename: "Aurelis.receized",
    fingerprint: cardArtifactFingerprint(asset),
    mimeType: "application/vnd.receiz.artifact"
  };
}

describe("prepared card artifact cache", () => {
  it("joins concurrent preparation for the same exact card", async () => {
    let calls = 0;
    let resolvePreparation!: (value: PreparedCardArtifact) => void;
    const cache = createPreparedCardArtifactCache((asset) => {
      calls += 1;
      return new Promise((resolve) => { resolvePreparation = resolve; });
    });
    const selected = card();

    const first = cache.prepare(selected);
    const second = cache.prepare(selected);
    resolvePreparation(artifact(selected));

    assert.equal(calls, 1);
    assert.strictEqual(await first, await second);
  });

  it("invalidates prepared work when the exact card revision changes", async () => {
    let calls = 0;
    const cache = createPreparedCardArtifactCache(async (asset) => {
      calls += 1;
      return artifact(asset);
    });

    const first = await cache.prepare(card(1));
    const second = await cache.prepare(card(2));

    assert.equal(calls, 2);
    assert.notEqual(first.fingerprint, second.fingerprint);
  });

  it("evicts rejected preparation so an explicit action can retry", async () => {
    let calls = 0;
    const cache = createPreparedCardArtifactCache(async (asset) => {
      calls += 1;
      if (calls === 1) throw new Error("prepare_failed");
      return artifact(asset);
    });

    await assert.rejects(cache.prepare(card()), /prepare_failed/);
    const recovered = await cache.prepare(card());

    assert.equal(calls, 2);
    assert.equal(recovered.filename, "Aurelis.receized");
  });
});
