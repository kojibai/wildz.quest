import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("onboarding keeps the Wildz promise above the explorer choice", () => {
  const source = readFileSync("src/features/identity/WildzInWorldOnboarding.tsx", "utf8");
  assert.match(source, /Choose your explorer/);
  assert.match(source, /\/brand\/wildz-wordmark\.svg/);
  assert.match(source, /className="wildz-onboarding-brand"/);
  assert.match(source, /Catch living creatures shaped by the moment\./);
  assert.match(source, /Train, evolve, breed &amp; carry them anywhere\. No two Wildz are ever the same\./);
  assert.match(source, /Pick the explorer who will enter the Wildz\./);
  assert.doesNotMatch(source, /enter the Wilds/);
  assert.doesNotMatch(source, /Receiz ID|Add Vault|Profile|Choose your Receiz username|Create Receiz ID|onCreateIdentity/);
});
