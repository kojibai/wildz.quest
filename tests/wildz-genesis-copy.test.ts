import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Genesis communicates portable ownership without visible Kai Pulse jargon", () => {
  const source = readFileSync("src/features/identity/WildzGenesis.tsx", "utf8");
  assert.match(source, /Catch, grow, own, and cash out creatures you can take anywhere\./);
  assert.match(source, /Shaping your explorer/);
  assert.doesNotMatch(source, />[^<]*Kai Pulse[^<]*</);
});
