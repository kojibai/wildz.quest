import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Genesis uses the automatic Receiz ID without an entry-page username form", () => {
  const source = readFileSync("src/features/identity/WildzGenesis.tsx", "utf8");
  const mainLine = "Catch living creatures shaped by the moment.";
  const subtext = "Train, evolve, breed & carry them anywhere. No two Wildz are ever the same.";
  assert.match(source, new RegExp(mainLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, new RegExp(subtext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /className="wildz-genesis-copy"/);
  assert.match(source, /className="wildz-genesis-tagline"/);
  assert.match(source, /className="wildz-genesis-subtext"/);
  assert.match(source, /className="wildz-genesis-powered"/);
  assert.match(source, /href="https:\/\/receiz\.com\/wildz"/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /src="\/brand\/powered-by-receiz\.svg"/);
  assert.match(source, /alt="Powered by Receiz"/);
  assert.match(source, /width=\{96\}\s+height=\{26\}/);
  assert.match(source, /Shaping your explorer/);
  assert.doesNotMatch(source, />[^<]*Kai Pulse[^<]*</);
  assert.doesNotMatch(source, /Choose your Receiz username/);
  assert.doesNotMatch(source, /onCreateIdentity/);
  assert.doesNotMatch(source, /Create Receiz ID/);
  assert.match(source, /const activeIdentity = restoredIdentity \?\? identity/);
});
