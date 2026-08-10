import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("first entry contains no character-creation copy or choice gate", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.match(shell, /generateIdentityBoundWildzCharacter/);
  assert.doesNotMatch(`${shell}\n${campaign}`, /Choose your explorer|Pick the explorer|Female explorer|Male explorer|onCreateIdentity/);
});
