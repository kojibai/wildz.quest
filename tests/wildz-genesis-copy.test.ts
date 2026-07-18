import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("onboarding only asks the player to choose an explorer", () => {
  const source = readFileSync("src/features/identity/WildzInWorldOnboarding.tsx", "utf8");
  assert.match(source, /Choose your explorer/);
  assert.doesNotMatch(source, /Receiz ID|Add Vault|Profile|Choose your Receiz username|Create Receiz ID|onCreateIdentity/);
});
