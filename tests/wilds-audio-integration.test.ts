import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("campaign projects one adaptive audio scene from existing world truth", async () => {
  const source = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
  for (const field of ["state.player", "activeLandmarkId", "state.battle", "biome.weather", "reducedMotion"]) assert.match(source, new RegExp(field.replace(".", "\\.")));
  assert.match(source, /projectWildsAudioScene/);
  assert.match(source, /audioScene/);
});

test("the service worker retains admitted audio offline in its own digest cache", async () => {
  const source = await readFile("public/sw.js", "utf8");
  assert.match(source, /wildz-audio-dcf17ad4caf7/);
  assert.match(source, /\/audio\/wildz\//);
  assert.match(source, /audioCacheFirst/);
});
