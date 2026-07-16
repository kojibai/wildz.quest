import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import {
  WILDS_AUDIO_ASSETS,
  assertCommercialAudioCatalog
} from "../src/features/play/wilds-audio-catalog";

test("admits only local CC0, public-domain, or Receiz-owned audio", () => {
  assert.doesNotThrow(() => assertCommercialAudioCatalog(WILDS_AUDIO_ASSETS));
  assert.ok(WILDS_AUDIO_ASSETS.length >= 12);
  assert.ok(WILDS_AUDIO_ASSETS.every((asset) => asset.path.startsWith("/audio/wildz/")));
  assert.ok(WILDS_AUDIO_ASSETS.every((asset) => /^(CC0-1.0|Public-Domain|Receiz-Owned)$/.test(asset.license)));
  assert.ok(WILDS_AUDIO_ASSETS.every((asset) => /^[a-f0-9]{64}$/.test(asset.sha256)));
  assert.ok(WILDS_AUDIO_ASSETS.every((asset) => existsSync(`public${asset.path}`)));
});

test("ships music, ambience, interaction effects, and the exact Receiz signature", () => {
  const kinds = new Set(WILDS_AUDIO_ASSETS.map((asset) => asset.kind));
  assert.deepEqual([...kinds].sort(), ["ambience", "effect", "music", "signature"]);
  const signature = WILDS_AUDIO_ASSETS.find((asset) => asset.id === "receiz-kai-turah-signature");
  assert.equal(signature?.license, "Receiz-Owned");
  assert.equal(signature?.path, "/audio/wildz/signature/kai_turah_tone.mp3");
});

test("rejects attribution-dependent or unpinned catalog entries", () => {
  const base = WILDS_AUDIO_ASSETS[0]!;
  assert.throws(() => assertCommercialAudioCatalog([{ ...base, license: "CC-BY-4.0" as never }]), /Blocked license/);
  assert.throws(() => assertCommercialAudioCatalog([{ ...base, sha256: "pending" }]), /Missing digest/);
  assert.throws(() => assertCommercialAudioCatalog([{ ...base, path: "https://example.com/audio.ogg" as never }]), /Local audio path/);
});
