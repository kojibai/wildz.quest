import assert from "node:assert/strict";
import { test } from "node:test";
import { wildzStreamingVoiceProfile } from "../src/lib/receiz/wildz-voice-lock";

test("proof signatures produce stable low-latency neural voice and articulation settings", () => {
  const signature = "expression:0123456789abcdef";
  const first = wildzStreamingVoiceProfile(signature);
  const replay = wildzStreamingVoiceProfile(signature);
  const other = wildzStreamingVoiceProfile("expression:fedcba9876543210");

  assert.deepEqual(first, replay);
  assert.notDeepEqual(first, other);
  assert.ok(first.seed >= 0 && first.seed <= 0xffff_ffff);
  assert.ok(first.speed >= .94 && first.speed <= 1.06);
  assert.ok(first.brightnessHz >= 1_400 && first.brightnessHz <= 3_600);
  assert.ok(first.mouthResponse >= .82 && first.mouthResponse <= 1.18);
});
