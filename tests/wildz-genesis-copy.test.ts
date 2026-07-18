import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("onboarding uses the automatic Receiz ID without an entry-page login form", () => {
  const source = readFileSync("src/features/identity/WildzInWorldOnboarding.tsx", "utf8");
  assert.match(source, /Choose your explorer/);
  assert.match(source, /Receiz ID · @\{username\}/);
  assert.match(source, /Add Vault/);
  assert.match(source, /your Receiz ID will not change/);
  assert.match(source, /change Receiz ID in Profile/);
  assert.doesNotMatch(source, /Choose your Receiz username|Create Receiz ID|onCreateIdentity/);
});
