import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Genesis uses the automatic Receiz ID without an entry-page username form", () => {
  const source = readFileSync("src/features/identity/WildzGenesis.tsx", "utf8");
  assert.match(source, /Catch, grow, own, and cash out creatures you can take anywhere\./);
  assert.match(source, /Shaping your explorer/);
  assert.doesNotMatch(source, />[^<]*Kai Pulse[^<]*</);
  assert.doesNotMatch(source, /Choose your Receiz username/);
  assert.doesNotMatch(source, /onCreateIdentity/);
  assert.doesNotMatch(source, /Create Receiz ID/);
  assert.match(source, /const activeIdentity = restoredIdentity \?\? identity/);
});
