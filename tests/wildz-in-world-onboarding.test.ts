import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("first entry happens over the mounted world and keeps identity and Vault actions distinct", () => {
  const shell = read("src/features/shell/WildzApp.tsx");
  const chooser = read("src/features/identity/WildzInWorldOnboarding.tsx");

  assert.match(shell, /continuity && identity && campaignCharacter \? <PlayCampaign/);
  assert.match(shell, /character=\{campaignCharacter\}/);
  assert.match(shell, /networkEnabled=\{Boolean\(character\) && proofSessionConnected\}/);
  assert.match(shell, /<WildzInWorldOnboarding/);
  assert.match(shell, /"merge-vault"/);
  assert.match(shell, /setOverlay\(\{ kind: "profile"/);

  assert.match(chooser, /Choose your explorer/);
  assert.match(chooser, /Add Vault/);
  assert.match(chooser, /Continue or change Receiz ID in Profile/);
  assert.doesNotMatch(chooser, /Identity Seal or Vault/);
});

test("the in-world chooser is a fixed non-scrolling modal", () => {
  const styles = read("app/globals.css");
  assert.match(styles, /\.wildz-in-world-onboarding\s*\{[^}]*position:\s*fixed[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.wildz-onboarding-card\s*\{[^}]*max-height:\s*calc\(100dvh/s);
});
