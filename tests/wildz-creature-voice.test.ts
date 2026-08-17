import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveWildzCreatureVoiceAsset } from "../src/lib/receiz/wildz-creature-voice-asset";

test("Receiz unique creature voice admits real data URLs without a client model", () => {
  const voice = resolveWildzCreatureVoiceAsset({
    audioAsset: {
      dataUrl: "data:audio/wav;base64,UklGRg==",
      mimeType: "audio/wav",
      durationMs: 480
    },
    ttsProvider: { vendor: "receiz", model: "unique-creature-v1" }
  }, "expression:0123456789abcdef");

  assert.equal(voice?.dataUrl, "data:audio/wav;base64,UklGRg==");
  assert.equal(voice?.signature, "expression:0123456789abcdef");
  assert.equal(voice?.model, "unique-creature-v1");
});

test("Receiz voice normalizes streamed base64url and rejects non-audio payloads", () => {
  assert.equal(resolveWildzCreatureVoiceAsset({ audioB64u: "UklGRg", audioMimeType: "audio/wav" }, "expression:voice")?.dataUrl,
    "data:audio/wav;base64,UklGRg==");
  assert.equal(resolveWildzCreatureVoiceAsset({
    audioAsset: { dataUrl: "data:text/plain;base64,SGVsbG8=", mimeType: "text/plain" }
  }, "expression:voice"), null);
});
