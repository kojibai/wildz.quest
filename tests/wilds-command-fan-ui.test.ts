import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("world tools rest behind one trigger and expose controlled fan and panel state", async () => {
  const source = await readFile("src/features/play/WildsCommandDock.tsx", "utf8");

  assert.match(source, /className="wilds-world-tools-trigger"/);
  assert.match(source, /aria-label="Open world tools"/);
  assert.match(source, /className="wilds-world-tools-fan"/);
  assert.match(source, /toolsOpen: boolean/);
  assert.match(source, /panelKey: WildsCommandKey \| null/);
  assert.doesNotMatch(source, /useState<WildsCommandKey \| null>/);
});
