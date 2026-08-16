import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("first entry derives the proof explorer and enters play without a chooser", () => {
  const shell = read("src/features/shell/WildzApp.tsx");
  const campaign = read("src/features/play/PlayCampaign.tsx");

  assert.match(shell, /continuity && identity && campaignCharacter \? <PlayCampaign/);
  assert.match(shell, /character=\{campaignCharacter\}/);
  assert.match(shell, /networkEnabled=\{Boolean\(character\) && proofSessionConnected\}/);
  assert.match(shell, /generateIdentityBoundWildzCharacter/);
  assert.doesNotMatch(`${shell}\n${campaign}`, /Choose your explorer|Female explorer|Male explorer|WildzInWorldOnboarding/);
});

test("removed explorer selection leaves no hidden modal or dead mobile CSS", () => {
  const styles = read("app/globals.css");
  assert.doesNotMatch(styles, /wildz-in-world-onboarding|wildz-onboarding-card|wilds-avatar-select/);
});

test("the in-game Vault popover claims Vault files before saving the combined collection", () => {
  const shell = read("src/features/shell/WildzApp.tsx");
  const vault = read("src/features/profile/WildzVaultSheet.tsx");

  assert.match(shell, /overlay\.kind === "vault"[\s\S]*onAddVault=/);
  assert.match(shell, /onAddVault=[\s\S]*claimAndRestoreVaultArtifact/);
  assert.match(shell, /onSaveVault=/);
  assert.match(shell, /downloadWildzIdentityPlayerVault/);
  assert.match(vault, /Add Vault/);
  assert.match(vault, /Save combined Vault/);
  assert.match(vault, /onAddVault/);
  assert.match(vault, /onSaveVault/);
});
