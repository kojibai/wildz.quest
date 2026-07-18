import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("first entry only asks the player to choose an explorer", () => {
  const shell = read("src/features/shell/WildzApp.tsx");
  const chooser = read("src/features/identity/WildzInWorldOnboarding.tsx");

  assert.match(shell, /continuity && identity && campaignCharacter \? <PlayCampaign/);
  assert.match(shell, /character=\{campaignCharacter\}/);
  assert.match(shell, /networkEnabled=\{Boolean\(character\) && proofSessionConnected\}/);
  assert.match(shell, /<WildzInWorldOnboarding/);
  assert.match(chooser, /Choose your explorer/);
  assert.doesNotMatch(chooser, /Add Vault|Identity Seal|Receiz ID|Profile/);
});

test("the in-world chooser is a fixed non-scrolling modal", () => {
  const styles = read("app/globals.css");
  assert.match(styles, /\.wildz-in-world-onboarding\s*\{[^}]*position:\s*fixed[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.wildz-onboarding-card\s*\{[^}]*max-height:\s*calc\(100dvh/s);
});

test("the in-game Vault popover merges Vault files and saves the combined collection", () => {
  const shell = read("src/features/shell/WildzApp.tsx");
  const vault = read("src/features/profile/WildzVaultSheet.tsx");

  assert.match(shell, /overlay\.kind === "vault"[\s\S]*onAddVault=/);
  assert.match(shell, /onAddVault=[\s\S]*"merge-vault"/);
  assert.match(shell, /onSaveVault=/);
  assert.match(shell, /downloadWildzIdentityPlayerVault/);
  assert.match(vault, /Add Vault/);
  assert.match(vault, /Save combined Vault/);
  assert.match(vault, /onAddVault/);
  assert.match(vault, /onSaveVault/);
});
